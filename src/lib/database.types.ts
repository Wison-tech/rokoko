// Generado desde el proyecto Supabase ROKOKO (tablas y funciones de `public`).
// Si cambias el esquema, vuelve a generarlo.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type CategoryRow = {
  active: boolean;
  allows_extras: boolean;
  icon: string;
  id: number;
  name: string;
  note: string | null;
  slug: string;
  sort: number;
};
export type ProductRow = {
  active: boolean;
  category_id: number;
  created_at: string;
  description: string | null;
  featured: boolean;
  featured_sort: number;
  icon: string | null;
  id: number;
  is_extra: boolean;
  is_upsell: boolean;
  name: string;
  photo_url: string | null;
  show_category_note: boolean;
  slug: string;
  sort: number;
  tag: string | null;
  updated_at: string;
};
export type VariantRow = { id: number; label: string; price: number; product_id: number; sort: number };
export type OptionGroupRow = { hint: string | null; id: number; label: string; max_select: number; min_select: number; name: string };
export type OptionChoiceRow = { active: boolean; group_id: number; id: number; label: string; price: number; sort: number; weight: number };
export type ProductOptionGroupRow = { group_id: number; product_id: number; sort: number };
export type PartyPickRow = { id: number; party: string; product_id: number; sort: number; variant_id: number | null };
export type SettingsRow = {
  address: string;
  claim: string;
  delivery_note: string;
  hours: Json | null;
  id: number;
  name: string;
  ordering_enabled: boolean;
  payment_methods: string[];
  phone: string;
  updated_at: string;
  whatsapp: string;
};
export type AdminRow = { created_at: string; email: string; user_id: string };
export type OrderRow = {
  access_token: string;
  address: string | null;
  admin_note: string | null;
  barrio: string | null;
  cancel_reason: string | null;
  cash_with: number | null;
  code: string;
  created_at: string;
  customer_name: string;
  customer_phone: string | null;
  customer_signal: string | null;
  customer_signal_at: string | null;
  delivery_fee: number | null;
  id: string;
  items_count: number;
  mode: string;
  note: string | null;
  payment: string;
  reference: string | null;
  scheduled_time: string | null;
  status: string;
  status_changed_at: string;
  subtotal: number;
  table_number: string | null;
  total: number;
};
export type OrderItemRow = {
  category_name: string;
  extras: Json;
  id: number;
  line_total: number;
  note: string | null;
  options: Json;
  order_id: string;
  product_id: number | null;
  product_name: string;
  qty: number;
  unit_price: number;
  variant_label: string;
};

type Opt<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' };
  public: {
    Tables: {
      admins: Table<AdminRow, Opt<AdminRow, 'created_at'>>;
      categories: Table<CategoryRow, Opt<Omit<CategoryRow, 'id'>, 'active' | 'allows_extras' | 'icon' | 'note' | 'sort'>>;
      products: Table<
        ProductRow,
        Opt<
          Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>,
          | 'active' | 'description' | 'featured' | 'featured_sort' | 'icon' | 'is_extra' | 'is_upsell'
          | 'photo_url' | 'show_category_note' | 'sort' | 'tag'
        >
      >;
      product_variants: Table<VariantRow, Opt<Omit<VariantRow, 'id'>, 'label' | 'sort'>>;
      option_groups: Table<OptionGroupRow, Opt<Omit<OptionGroupRow, 'id'>, 'hint' | 'min_select' | 'max_select'>>;
      option_choices: Table<OptionChoiceRow, Opt<Omit<OptionChoiceRow, 'id'>, 'active' | 'price' | 'sort' | 'weight'>>;
      product_option_groups: Table<ProductOptionGroupRow, Opt<ProductOptionGroupRow, 'sort'>>;
      party_picks: Table<PartyPickRow, Opt<Omit<PartyPickRow, 'id'>, 'sort' | 'variant_id'>>;
      settings: Table<SettingsRow, Partial<SettingsRow>>;
      orders: Table<OrderRow, Partial<OrderRow>>;
      order_items: Table<OrderItemRow, Partial<OrderItemRow>>;
    };
    Views: { [_ in never]: never };
    Functions: {
      add_admin: { Args: { p_email: string }; Returns: boolean };
      admin_metrics: { Args: { p_from: string; p_to: string }; Returns: Json };
      admin_setup_needed: { Args: never; Returns: boolean };
      claim_first_admin: { Args: never; Returns: boolean };
      create_order: { Args: { p: Json }; Returns: Json };
      customer_signal: { Args: { p_id: string; p_signal: string; p_token: string }; Returns: string };
      track_orders: {
        Args: { p_orders: Json };
        Returns: {
          code: string;
          created_at: string;
          customer_signal: string;
          delivery_fee: number;
          id: string;
          status: string;
          status_changed_at: string;
          total: number;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
