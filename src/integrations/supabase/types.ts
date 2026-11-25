export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          closed_at: string | null
          created_at: string
          currency: string
          id: string
          opened_at: string
          party_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          account_number: string
          account_type?: Database["public"]["Enums"]["account_type"]
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          opened_at?: string
          party_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          account_number?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          closed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          opened_at?: string
          party_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      clusters: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          region: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          region?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          region?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clusters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cluster_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          kyc_status: string
          mobile: string | null
          organization_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_code: string
        }
        Insert: {
          cluster_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          kyc_status?: string
          mobile?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_code: string
        }
        Update: {
          cluster_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          kyc_status?: string
          mobile?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          account_class: Database["public"]["Enums"]["ledger_account_class"]
          code: string
          created_at: string
          currency: string
          id: string
          name: string
          normal_balance: Database["public"]["Enums"]["ledger_direction"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          wallet_id: string | null
        }
        Insert: {
          account_class: Database["public"]["Enums"]["ledger_account_class"]
          code: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          normal_balance: Database["public"]["Enums"]["ledger_direction"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          wallet_id?: string | null
        }
        Update: {
          account_class?: Database["public"]["Enums"]["ledger_account_class"]
          code?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          normal_balance?: Database["public"]["Enums"]["ledger_direction"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          created_at: string
          currency: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          ledger_account_id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          ledger_account_id: string
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          ledger_account_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_ledger_account_id_fkey"
            columns: ["ledger_account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          business_address: string | null
          business_name: string
          cluster_id: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          merchant_code: string
          mobile: string | null
          organization_id: string
          registration_number: string | null
          settlement_cycle: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          business_address?: string | null
          business_name: string
          cluster_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          merchant_code: string
          mobile?: string | null
          organization_id: string
          registration_number?: string | null
          settlement_cycle?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          business_address?: string | null
          business_name?: string
          cluster_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          merchant_code?: string
          mobile?: string | null
          organization_id?: string
          registration_number?: string | null
          settlement_cycle?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          code: string
          created_at: string
          currency: string
          email: string | null
          id: string
          legal_name: string | null
          mobile: string | null
          name: string
          registration_number: string | null
          status: Database["public"]["Enums"]["entity_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          mobile?: string | null
          name: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          mobile?: string | null
          name?: string
          registration_number?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          created_at: string
          customer_id: string | null
          display_name: string
          id: string
          merchant_id: string | null
          organization_id: string | null
          party_type: Database["public"]["Enums"]["party_type"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          display_name: string
          id?: string
          merchant_id?: string | null
          organization_id?: string | null
          party_type: Database["public"]["Enums"]["party_type"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          display_name?: string
          id?: string
          merchant_id?: string | null
          organization_id?: string | null
          party_type?: Database["public"]["Enums"]["party_type"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          enabled: boolean
          id: string
          name: string
          provider_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          provider_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          code: string
          created_at: string
          enabled: boolean
          environment: string
          id: string
          name: string
          notes: string | null
          priority: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          name: string
          notes?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          name?: string
          notes?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          idempotency_key: string | null
          organization_id: string | null
          posted_at: string | null
          reference: string
          reverses_transaction_id: string | null
          status: Database["public"]["Enums"]["txn_status"]
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id?: string | null
          posted_at?: string | null
          reference: string
          reverses_transaction_id?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id?: string | null
          posted_at?: string | null
          reference?: string
          reverses_transaction_id?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reverses_transaction_id_fkey"
            columns: ["reverses_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          from_wallet_id: string
          id: string
          note: string | null
          reference: string
          status: Database["public"]["Enums"]["txn_status"]
          to_wallet_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          from_wallet_id: string
          id?: string
          note?: string | null
          reference: string
          status?: Database["public"]["Enums"]["txn_status"]
          to_wallet_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          from_wallet_id?: string
          id?: string
          note?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["txn_status"]
          to_wallet_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_wallet_id_fkey"
            columns: ["from_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          account_id: string
          available_balance: number
          created_at: string
          currency: string
          held_balance: number
          id: string
          pending_balance: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          wallet_number: string
        }
        Insert: {
          account_id: string
          available_balance?: number
          created_at?: string
          currency?: string
          held_balance?: number
          id?: string
          pending_balance?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          wallet_number: string
        }
        Update: {
          account_id?: string
          available_balance?: number
          created_at?: string
          currency?: string
          held_balance?: number
          id?: string
          pending_balance?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          wallet_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      post_transaction: {
        Args: {
          p_currency: string
          p_description: string
          p_entries: Json
          p_idempotency_key: string
          p_organization_id: string
          p_reference: string
          p_transaction_type: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "WALLET" | "SETTLEMENT" | "FEE" | "CLEARING" | "SUSPENSE"
      app_role: "admin" | "operator" | "viewer"
      entity_status: "ACTIVE" | "SUSPENDED" | "CLOSED" | "PENDING"
      ledger_account_class:
        | "ASSET"
        | "LIABILITY"
        | "EQUITY"
        | "REVENUE"
        | "EXPENSE"
      ledger_direction: "DEBIT" | "CREDIT"
      party_type: "USER" | "MERCHANT" | "ORGANIZATION" | "SYSTEM"
      txn_status: "PENDING" | "POSTED" | "FAILED" | "REVERSED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["WALLET", "SETTLEMENT", "FEE", "CLEARING", "SUSPENSE"],
      app_role: ["admin", "operator", "viewer"],
      entity_status: ["ACTIVE", "SUSPENDED", "CLOSED", "PENDING"],
      ledger_account_class: [
        "ASSET",
        "LIABILITY",
        "EQUITY",
        "REVENUE",
        "EXPENSE",
      ],
      ledger_direction: ["DEBIT", "CREDIT"],
      party_type: ["USER", "MERCHANT", "ORGANIZATION", "SYSTEM"],
      txn_status: ["PENDING", "POSTED", "FAILED", "REVERSED"],
    },
  },
} as const
