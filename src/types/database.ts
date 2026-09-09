export type OrderStatus =
  | 'ordered'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentMethod =
  | 'upi'
  | 'credit_card'
  | 'debit_card'
  | 'netbanking'
  | 'cash'
  | 'wallet';

export type DocType =
  | 'invoice'
  | 'receipt'
  | 'order_confirmation'
  | 'warranty'
  | 'delivery_proof'
  | 'other';

export type ActivityType =
  | 'research'
  | 'price_comparison'
  | 'ordering'
  | 'testing'
  | 'integration'
  | 'debugging'
  | 'documentation'
  | 'other';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
}

export interface Seller {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  created_at: string;
}

export type LifecycleStatus =
  | 'received'
  | 'tested'
  | 'in_use'
  | 'repaired'
  | 'retired';

export interface LifecycleEvent {
  id: string;
  purchase_id: string;
  status: LifecycleStatus;
  changed_at: string;
  notes?: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  project_id: string | null;
  seller_id: string | null;
  item_name: string;
  category: string | null;
  purpose: string | null;
  quantity: number;
  base_price: number;
  gst_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  order_status: OrderStatus;
  lifecycle_status: LifecycleStatus | null;
  order_date: string | null;
  expected_delivery_date: string | null;
  delivered_date: string | null;
  payment_method: PaymentMethod | null;
  transaction_id: string | null;
  warranty_months: number | null;
  return_window_days: number | null;
  storage_location: string | null;
  created_at: string;
  updated_at: string;
  // Relations (joined)
  seller?: Seller;
  project?: Project;
  documents?: Document[];
  inventory?: InventoryItem[];
  lifecycle_events?: LifecycleEvent[];
}

export interface Document {
  id: string;
  purchase_id: string;
  doc_type: DocType;
  file_path: string;
  extracted_data: Record<string, unknown> | null;
  uploaded_at: string;
}

export interface InventoryItem {
  id: string;
  purchase_id: string;
  item_name: string;
  quantity_purchased: number;
  quantity_used: number;
  quantity_available: number;
  location: string | null;
}

export interface TimeEntry {
  id: string;
  purchase_id: string | null;
  project_id: string | null;
  activity_type: ActivityType;
  duration_minutes: number;
  notes: string | null;
  logged_at: string;
  user_id: string;
  // Relations
  purchase?: Purchase;
  project?: Project;
}

export interface VendorSummary {
  seller_id: string;
  seller_name: string;
  order_count: number;
  total_spent: number;
}

export interface ProjectSummary {
  project_id: string;
  project_name: string;
  total_spent: number;
  total_time_minutes: number;
  item_count: number;
}

// Supabase Database generic type shape (for typed client)
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> };
      projects: { Row: Project; Insert: Omit<Project, 'id' | 'created_at'>; Update: Partial<Project> };
      project_members: { Row: ProjectMember; Insert: Omit<ProjectMember, 'id'>; Update: Partial<ProjectMember> };
      sellers: { Row: Seller; Insert: Omit<Seller, 'id' | 'created_at'>; Update: Partial<Seller> };
      purchases: { Row: Purchase; Insert: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Purchase> };
      documents: { Row: Document; Insert: Omit<Document, 'id' | 'uploaded_at'>; Update: Partial<Document> };
      inventory: { Row: InventoryItem; Insert: Omit<InventoryItem, 'id'>; Update: Partial<InventoryItem> };
      time_entries: { Row: TimeEntry; Insert: Omit<TimeEntry, 'id'>; Update: Partial<TimeEntry> };
      lifecycle_events: { Row: LifecycleEvent; Insert: Omit<LifecycleEvent, 'id' | 'created_at'>; Update: Partial<LifecycleEvent> };
    };
    Views: {
      vendor_summary: { Row: VendorSummary };
      project_summary: { Row: ProjectSummary };
    };
    Functions: Record<string, never>;
    Enums: {
      order_status: OrderStatus;
      lifecycle_status: LifecycleStatus;
      payment_method: PaymentMethod;
      doc_type: DocType;
      activity_type: ActivityType;
      project_role: ProjectRole;
    };
  };
};
