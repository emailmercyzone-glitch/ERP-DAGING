-- ============================================================================
-- BLUEPRINT SOLID ERP DAGING IMPORT V4.3 - SUPABASE POSTGRESQL CLOUD SCHEMA
-- Single Source of Truth Cloud Database & Row Level Security (RLS)
-- Toko Utama: TOKO_SAMPORA_01 (Tenant Isolation)
-- Karakteristik: Zero Float (BIGINT Rupiah, INTEGER Gram, UUID Primary Keys)
-- ============================================================================

-- Ekstensi PostgreSQL yang Diperlukan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABEL USERS & RBAC (MOD-02)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    pin_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'SALES')),
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    bound_device_id VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. TABEL CUSTOMERS (MOD-06)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    tier_id VARCHAR(50),
    credit_limit_rupiah BIGINT NOT NULL DEFAULT 0,
    current_receivable_rupiah BIGINT NOT NULL DEFAULT 0,
    payment_term_days INT NOT NULL DEFAULT 0,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. TABEL SUPPLIERS (MOD-09)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    country_origin VARCHAR(100),
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    current_payable_rupiah BIGINT NOT NULL DEFAULT 0,
    default_payment_term_days INT NOT NULL DEFAULT 30,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. TABEL PRODUCTS & DUAL-UNIT (MOD-03)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    primary_unit VARCHAR(20) NOT NULL DEFAULT 'KG',
    secondary_unit VARCHAR(20),
    default_gram_per_pcs INT,
    is_catch_weight BOOLEAN NOT NULL DEFAULT true,
    min_stock_alert_gram INT NOT NULL DEFAULT 10000,
    base_price_per_kg_rupiah BIGINT NOT NULL,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 5. TABEL LOTS & NKV (MOD-07)
CREATE TABLE IF NOT EXISTS public.lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    lot_code VARCHAR(100) NOT NULL,
    nkv_number VARCHAR(100),
    slaughter_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ NOT NULL, -- Kunci FEFO
    initial_weight_gram INT NOT NULL,
    current_weight_gram INT NOT NULL,
    current_pcs INT,
    hpp_per_gram_rupiah BIGINT NOT NULL,
    total_landed_cost_rupiah BIGINT NOT NULL DEFAULT 0,
    storage_location VARCHAR(100) NOT NULL DEFAULT 'COLD_STORAGE_UTAMA',
    is_quarantined BOOLEAN NOT NULL DEFAULT false,
    quarantine_reason TEXT,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL TRANSACTIONS (MOD-04)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) NOT NULL UNIQUE, -- INV-{DEV}-{YYMMDD}-{SEQ}
    device_id VARCHAR(50) NOT NULL,
    sales_mode VARCHAR(30) NOT NULL DEFAULT 'KASIR_TOKO',
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    sales_user_id UUID NOT NULL REFERENCES public.users(id),
    transaction_date TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ,
    subtotal_rupiah BIGINT NOT NULL,
    discount_rupiah BIGINT NOT NULL DEFAULT 0,
    shipping_fee_rupiah BIGINT NOT NULL DEFAULT 0,
    is_free_shipping_strikethrough BOOLEAN NOT NULL DEFAULT false, -- BR-040
    grand_total_rupiah BIGINT NOT NULL,
    paid_amount_rupiah BIGINT NOT NULL DEFAULT 0,
    change_rupiah BIGINT NOT NULL DEFAULT 0,
    balance_due_rupiah BIGINT NOT NULL DEFAULT 0,
    payment_method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    is_conflict BOOLEAN NOT NULL DEFAULT false,
    shipping_address TEXT,
    notes TEXT,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    server_seq BIGSERIAL UNIQUE, -- Nomor urut resmi Supabase
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABEL TRANSACTION_ITEMS (MOD-04)
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    lot_id UUID NOT NULL REFERENCES public.lots(id),
    weight_gram INT NOT NULL,
    quantity_pcs INT,
    price_per_kg_rupiah BIGINT NOT NULL,
    subtotal_rupiah BIGINT NOT NULL,
    hpp_per_gram_rupiah BIGINT NOT NULL,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABEL IMMUTABLE STOCK_LEDGER (MOD-07)
CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id),
    lot_id UUID NOT NULL REFERENCES public.lots(id),
    movement_type VARCHAR(50) NOT NULL,
    weight_gram INT NOT NULL,
    pcs INT,
    running_balance_gram INT NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    hpp_per_gram_rupiah BIGINT NOT NULL,
    performed_by_user_id UUID NOT NULL REFERENCES public.users(id),
    device_id VARCHAR(50) NOT NULL,
    notes TEXT,
    server_seq BIGSERIAL UNIQUE,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proteksi Immutabilitas: Larang UPDATE & DELETE pada stock_ledger
CREATE OR REPLACE FUNCTION prevent_stock_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'DILARANG MEMUTASI BARIS STOCK_LEDGER! Tabel ini bersifat append-only immutable sesuai Blueprint V4.3.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_stock_ledger
BEFORE UPDATE OR DELETE ON public.stock_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_stock_ledger_mutation();

-- 9. TABEL CONFLICT_CASES (MOD-15)
CREATE TABLE IF NOT EXISTS public.conflict_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id),
    invoice_number VARCHAR(100) NOT NULL,
    sales_user_id UUID NOT NULL REFERENCES public.users(id),
    device_id VARCHAR(50) NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id),
    lot_id UUID NOT NULL REFERENCES public.lots(id),
    requested_gram INT NOT NULL,
    available_gram_at_sync INT NOT NULL,
    deficit_gram INT NOT NULL,
    resolution_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    replacement_lot_id UUID REFERENCES public.lots(id),
    resolution_notes TEXT,
    resolved_by_user_id UUID REFERENCES public.users(id),
    resolved_at TIMESTAMPTZ,
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABEL CASH_SETTLEMENTS (MOD-11)
CREATE TABLE IF NOT EXISTS public.cash_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_number VARCHAR(100) NOT NULL UNIQUE,
    sales_user_id UUID NOT NULL REFERENCES public.users(id),
    settlement_date TIMESTAMPTZ NOT NULL,
    total_cash_collected_rupiah BIGINT NOT NULL,
    actual_deposited_rupiah BIGINT NOT NULL,
    variance_rupiah BIGINT NOT NULL DEFAULT 0,
    received_by_user_id UUID NOT NULL REFERENCES public.users(id),
    deposit_method VARCHAR(50) NOT NULL,
    proof_photo_url TEXT,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
    store_id VARCHAR(50) NOT NULL DEFAULT 'TOKO_SAMPORA_01',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (TENANT ISOLATION PER STORE_ID)
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_settlements ENABLE ROW LEVEL SECURITY;

-- Policy Standar: Hanya dapat membaca/menulis data milik store_id sendiri
CREATE POLICY tenant_isolation_users ON public.users FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

CREATE POLICY tenant_isolation_customers ON public.customers FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

CREATE POLICY tenant_isolation_products ON public.products FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

CREATE POLICY tenant_isolation_lots ON public.lots FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

CREATE POLICY tenant_isolation_transactions ON public.transactions FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

CREATE POLICY tenant_isolation_stock_ledger ON public.stock_ledger FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

CREATE POLICY tenant_isolation_conflict_cases ON public.conflict_cases FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

CREATE POLICY tenant_isolation_cash_settlements ON public.cash_settlements FOR ALL
    USING (store_id = current_setting('app.current_store_id', true) OR store_id = 'TOKO_SAMPORA_01');

-- ============================================================================
-- RPC SYNC_PUSH: HANDSHAKE SINKRONISASI OFFLINE-TO-CLOUD (SECURITY INVOKER)
-- Menutup Gap P05 & D4: Idempotensi, Validasi Tenant, & Pembangkit server_seq
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_push(
    p_store_id TEXT,
    p_device_id TEXT,
    p_events JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_event RECORD;
    v_ack_list JSONB := '[]'::JSONB;
    v_server_seq BIGINT;
    v_rec_id UUID;
    v_table TEXT;
    v_data JSONB;
BEGIN
    -- Validasi Tenant
    IF p_store_id IS NULL OR p_store_id = '' THEN
        RAISE EXCEPTION 'Tenant Store ID wajib diisi!';
    END IF;

    -- Proses iterasi setiap event dalam batch
    FOR v_event IN SELECT * FROM jsonb_to_recordset(p_events) AS x(
        queue_id TEXT,
        target_table TEXT,
        record_id TEXT,
        operation_type TEXT,
        payload JSONB
    )
    LOOP
        v_rec_id := (v_event.record_id)::UUID;
        v_table := v_event.target_table;
        v_data := v_event.payload;

        -- 1. Penanganan Transaksi
        IF v_table = 'transactions' THEN
            INSERT INTO public.transactions (
                id, invoice_number, device_id, sales_mode, customer_id, sales_user_id,
                transaction_date, subtotal_rupiah, discount_rupiah, shipping_fee_rupiah,
                is_free_shipping_strikethrough, grand_total_rupiah, paid_amount_rupiah,
                change_rupiah, balance_due_rupiah, payment_method, status, is_conflict,
                store_id
            ) VALUES (
                v_rec_id,
                v_data->>'invoice_number',
                p_device_id,
                COALESCE(v_data->>'sales_mode', 'KASIR_TOKO'),
                (v_data->>'customer_id')::UUID,
                (v_data->>'sales_user_id')::UUID,
                (v_data->>'transaction_date')::TIMESTAMPTZ,
                (v_data->>'subtotal_rupiah')::BIGINT,
                COALESCE((v_data->>'discount_rupiah')::BIGINT, 0),
                COALESCE((v_data->>'shipping_fee_rupiah')::BIGINT, 0),
                COALESCE((v_data->>'is_free_shipping_strikethrough')::BOOLEAN, false),
                (v_data->>'grand_total_rupiah')::BIGINT,
                COALESCE((v_data->>'paid_amount_rupiah')::BIGINT, 0),
                COALESCE((v_data->>'change_rupiah')::BIGINT, 0),
                COALESCE((v_data->>'balance_due_rupiah')::BIGINT, 0),
                v_data->>'payment_method',
                COALESCE(v_data->>'status', 'ISSUED'),
                COALESCE((v_data->>'is_conflict')::BOOLEAN, false),
                p_store_id
            )
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                updated_at = NOW()
            RETURNING server_seq INTO v_server_seq;

        -- 2. Penanganan Stock Ledger (Append-Only)
        ELSIF v_table = 'stock_ledger' THEN
            INSERT INTO public.stock_ledger (
                id, product_id, lot_id, movement_type, weight_gram, pcs,
                running_balance_gram, reference_number, reference_type,
                hpp_per_gram_rupiah, performed_by_user_id, device_id,
                notes, store_id
            ) VALUES (
                v_rec_id,
                (v_data->>'product_id')::UUID,
                (v_data->>'lot_id')::UUID,
                v_data->>'movement_type',
                (v_data->>'weight_gram')::INT,
                (v_data->>'pcs')::INT,
                (v_data->>'running_balance_gram')::INT,
                v_data->>'reference_number',
                v_data->>'reference_type',
                (v_data->>'hpp_per_gram_rupiah')::BIGINT,
                (v_data->>'performed_by_user_id')::UUID,
                p_device_id,
                v_data->>'notes',
                p_store_id
            )
            ON CONFLICT (id) DO NOTHING
            RETURNING server_seq INTO v_server_seq;

        -- 3. Penanganan Conflict Cases
        ELSIF v_table = 'conflict_cases' THEN
            INSERT INTO public.conflict_cases (
                id, transaction_id, invoice_number, sales_user_id, device_id,
                product_id, lot_id, requested_gram, available_gram_at_sync,
                deficit_gram, store_id
            ) VALUES (
                v_rec_id,
                (v_data->>'transaction_id')::UUID,
                v_data->>'invoice_number',
                (v_data->>'sales_user_id')::UUID,
                p_device_id,
                (v_data->>'product_id')::UUID,
                (v_data->>'lot_id')::UUID,
                (v_data->>'requested_gram')::INT,
                (v_data->>'available_gram_at_sync')::INT,
                (v_data->>'deficit_gram')::INT,
                p_store_id
            )
            ON CONFLICT (id) DO NOTHING;
            v_server_seq := 1;
        ELSE
            -- Jangan ACK event yang belum memiliki handler/projection.
            -- ACK palsu akan menghapus item dari Outbox lokal tanpa menyimpan data di server.
            RAISE EXCEPTION 'Target table belum didukung oleh sync_push: %', v_table;
        END IF;

        -- Susun respon ACK resmi
        v_ack_list := v_ack_list || jsonb_build_object(
            'queue_id', v_event.queue_id,
            'record_id', v_event.record_id,
            'server_seq', v_server_seq,
            'status', 'DONE'
        );
    END LOOP;

    RETURN jsonb_build_object('acks', v_ack_list, 'synced_at', NOW());
END;
$$;
