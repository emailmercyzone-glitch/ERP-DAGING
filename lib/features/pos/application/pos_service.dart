import 'package:drift/drift.dart';
import '../../../core/database/app_database.dart';
import '../../../core/database/daos/transaction_dao.dart';
import 'fefo_allocation_service.dart';
import '../../customers/application/credit_limit_service.dart';

/// Item di dalam Keranjang Belanja POS
class CartItem {
  final ProductEntry product;
  final int weightGram; // Berat aktual hasil timbangan (Gram Utuh)
  final int? pcs;
  final BigInt pricePerKgRupiah; // Harga per KG terhitung (berdasarkan tier pelanggan)

  CartItem({
    required this.product,
    required this.weightGram,
    this.pcs,
    required this.pricePerKgRupiah,
  });

  /// Kalkulasi Subtotal Item Zero-Float: (Gram * HargaPerKG) / 1000
  BigInt get subtotalRupiah => (BigInt.from(weightGram) * pricePerKgRupiah) ~/ BigInt.from(1000);
}

/// Request Checkout Kasir / Sales
class CheckoutRequest {
  final String transactionId;
  final String deviceId;
  final String salesMode; // KASIR_TOKO atau SALES_LAPANGAN
  final String customerId;
  final String salesUserId;
  final String paymentMethod; // CASH, TRANSFER, TEMPO, SPLIT
  final BigInt discountRupiah;
  final BigInt actualShippingFeeRupiah;
  final bool isFreeShippingStrikethrough; // Struk coret ongkir
  final BigInt paidAmountRupiah;
  final DateTime? dueDate;
  final String? shippingAddress;
  final String? notes;
  final bool isOwnerCreditOverrideApproved; // Jika di-override oleh Owner
  final List<CartItem> cartItems;

  CheckoutRequest({
    required this.transactionId,
    required this.deviceId,
    required this.salesMode,
    required this.customerId,
    required this.salesUserId,
    required this.paymentMethod,
    this.discountRupiah = BigInt.zero,
    this.actualShippingFeeRupiah = BigInt.zero,
    this.isFreeShippingStrikethrough = false,
    required this.paidAmountRupiah,
    this.dueDate,
    this.shippingAddress,
    this.notes,
    this.isOwnerCreditOverrideApproved = false,
    required this.cartItems,
  });
}

/// MOD-04: Orkestrator POS Unified Dual-Mode Engine
class PosService {
  final AppDatabase db;
  final TransactionDao transactionDao;
  final FefoAllocationService fefoService;
  final CreditLimitService creditLimitService;

  PosService({
    required this.db,
    required this.transactionDao,
    required this.fefoService,
    required this.creditLimitService,
  });

  /// Mengambil harga jual per KG untuk produk tertentu berdasarkan tier pelanggan
  Future<BigInt> resolveProductPricePerKg({
    required String productId,
    String? tierId,
    int weightGram = 0,
  }) async {
    // 1. Cek apakah ada harga khusus tier di product_prices
    if (tierId != null) {
      final tierPrice = await (db.select(db.productPricesTable)
            ..where((tbl) => 
                tbl.productId.equals(productId) & 
                tbl.tierId.equals(tierId) & 
                tbl.minWeightGram.isSmallerOrEqualValue(weightGram)))
          .getSingleOrNull();

      if (tierPrice != null) {
        return tierPrice.pricePerKgRupiah;
      }
    }

    // 2. Fallback ke harga dasar eceran di products
    final product = await (db.select(db.productsTable)..where((tbl) => tbl.id.equals(productId))).getSingle();
    return product.basePricePerKgRupiah;
  }

  /// Eksekusi Checkout Lengkap dengan Validasi FEFO & Plafon Piutang
  Future<TransactionEntry> executeCheckout(CheckoutRequest req) async {
    if (req.cartItems.isEmpty) {
      throw ArgumentError('Keranjang belanja tidak boleh kosong.');
    }

    // 1. Hitung Subtotal Seluruh Item
    BigInt subtotalRupiah = BigInt.zero;
    for (final item in req.cartItems) {
      subtotalRupiah += item.subtotalRupiah;
    }

    // Biaya ongkir efektif (jika dicoret gratis, maka 0)
    final effectiveShipping = req.isFreeShippingStrikethrough ? BigInt.zero : req.actualShippingFeeRupiah;
    final grandTotalRupiah = subtotalRupiah - req.discountRupiah + effectiveShipping;

    BigInt changeRupiah = BigInt.zero;
    BigInt balanceDueRupiah = BigInt.zero;

    if (req.paymentMethod == 'TEMPO') {
      balanceDueRupiah = grandTotalRupiah - req.paidAmountRupiah;
    } else {
      if (req.paidAmountRupiah > grandTotalRupiah) {
        changeRupiah = req.paidAmountRupiah - grandTotalRupiah;
      } else if (req.paidAmountRupiah < grandTotalRupiah) {
        balanceDueRupiah = grandTotalRupiah - req.paidAmountRupiah;
      }
    }

    // 2. Validasi Plafon Piutang jika metode pembayaran TEMPO
    if (req.paymentMethod == 'TEMPO') {
      final creditCheck = await creditLimitService.evaluateCustomerCredit(
        customerId: req.customerId,
        newInvoiceAmountRupiah: balanceDueRupiah,
      );

      if (creditCheck.isBlocked && !req.isOwnerCreditOverrideApproved) {
        throw StateError(
          'Transaksi Tempo Ditolak: ${creditCheck.warningMessage ?? "Melebihi batas plafon piutang"}.',
        );
      }
    }

    // 3. Alokasi FEFO untuk setiap item keranjang
    final List<SaleItemParam> saleItems = [];

    for (final cartItem in req.cartItems) {
      final alloc = await fefoService.allocateProductWeight(
        productId: cartItem.product.id,
        requestedGram: cartItem.weightGram,
      );

      if (alloc.chunks.isEmpty) {
        // Jika benar-benar tidak ada lot sama sekali, buat 1 baris dummy lot untuk dicatat di conflict_cases
        saleItems.add(
          SaleItemParam(
            productId: cartItem.product.id,
            lotId: 'NO_LOT_AVAILABLE',
            weightGram: cartItem.weightGram,
            quantityPcs: cartItem.pcs,
            pricePerKgRupiah: cartItem.pricePerKgRupiah,
            subtotalRupiah: cartItem.subtotalRupiah,
            hppPerGramRupiah: BigInt.zero,
          ),
        );
      } else {
        // Masukkan alokasi per lot (bisa split lot jika 1 lot tidak mencukupi)
        for (final chunk in alloc.chunks) {
          final chunkSubtotal = (BigInt.from(chunk.allocatedGram) * cartItem.pricePerKgRupiah) ~/ BigInt.from(1000);
          saleItems.add(
            SaleItemParam(
              productId: cartItem.product.id,
              lotId: chunk.lotId,
              weightGram: chunk.allocatedGram,
              quantityPcs: cartItem.pcs,
              pricePerKgRupiah: cartItem.pricePerKgRupiah,
              subtotalRupiah: chunkSubtotal,
              hppPerGramRupiah: chunk.hppPerGramRupiah,
            ),
          );
        }

        // Jika ada defisit gram yang tidak terpenuhi oleh lot yang ada
        if (alloc.hasDeficit) {
          final deficitSubtotal = (BigInt.from(alloc.deficitGram) * cartItem.pricePerKgRupiah) ~/ BigInt.from(1000);
          saleItems.add(
            SaleItemParam(
              productId: cartItem.product.id,
              lotId: alloc.chunks.first.lotId, // Gunakan lot pertama sebagai acuan bentrok
              weightGram: alloc.deficitGram,
              quantityPcs: null,
              pricePerKgRupiah: cartItem.pricePerKgRupiah,
              subtotalRupiah: deficitSubtotal,
              hppPerGramRupiah: alloc.chunks.first.hppPerGramRupiah,
            ),
          );
        }
      }
    }

    // 4. Panggil TransactionDao untuk simpan secara atomik
    final transaction = await transactionDao.createSaleTransaction(
      transactionId: req.transactionId,
      deviceId: req.deviceId,
      salesMode: req.salesMode,
      customerId: req.customerId,
      salesUserId: req.salesUserId,
      paymentMethod: req.paymentMethod,
      subtotalRupiah: subtotalRupiah,
      discountRupiah: req.discountRupiah,
      shippingFeeRupiah: req.actualShippingFeeRupiah,
      isFreeShippingStrikethrough: req.isFreeShippingStrikethrough,
      grandTotalRupiah: grandTotalRupiah,
      paidAmountRupiah: req.paidAmountRupiah,
      changeRupiah: changeRupiah,
      balanceDueRupiah: balanceDueRupiah,
      dueDate: req.dueDate,
      shippingAddress: req.shippingAddress,
      notes: req.notes,
      items: saleItems,
    );

    // 5. Jika TEMPO, perbarui saldo piutang pelanggan
    if (req.paymentMethod == 'TEMPO' && balanceDueRupiah > BigInt.zero) {
      await creditLimitService.addReceivable(
        customerId: req.customerId,
        amountRupiah: balanceDueRupiah,
      );
    }

    return transaction;
  }
}
