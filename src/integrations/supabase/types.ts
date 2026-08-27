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
      centro_custo: {
        Row: {
          atividade: string
          ativo: boolean
          codigo_pai: string | null
          codigo_rm: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          atividade: string
          ativo?: boolean
          codigo_pai?: string | null
          codigo_rm: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          atividade?: string
          ativo?: boolean
          codigo_pai?: string | null
          codigo_rm?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      compromisso: {
        Row: {
          created_at: string
          data_prevista: string | null
          descricao: string
          fornecedor: string | null
          id: string
          item_orcamento_id: string
          numero_pedido: string | null
          status: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          descricao: string
          fornecedor?: string | null
          id?: string
          item_orcamento_id: string
          numero_pedido?: string | null
          status?: string
          valor: number
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          item_orcamento_id?: string
          numero_pedido?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "compromisso_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "item_orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromisso_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_acumulado"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "compromisso_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_mes"
            referencedColumns: ["item_id"]
          },
        ]
      }
      conta_investimento: {
        Row: {
          ativa: boolean
          conta: string
          descricao: string | null
        }
        Insert: {
          ativa?: boolean
          conta: string
          descricao?: string | null
        }
        Update: {
          ativa?: boolean
          conta?: string
          descricao?: string | null
        }
        Relationships: []
      }
      importacao: {
        Row: {
          arquivo: string
          competencia: string | null
          created_at: string
          id: string
          linhas: number
          usuario: string | null
          valor_total: number
        }
        Insert: {
          arquivo: string
          competencia?: string | null
          created_at?: string
          id?: string
          linhas?: number
          usuario?: string | null
          valor_total?: number
        }
        Update: {
          arquivo?: string
          competencia?: string | null
          created_at?: string
          id?: string
          linhas?: number
          usuario?: string | null
          valor_total?: number
        }
        Relationships: []
      }
      item_orcamento: {
        Row: {
          centro_custo_id: string
          codigo: string
          created_at: string
          descricao: string
          id: string
          observacao: string | null
          responsavel: string | null
          safra_id: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          centro_custo_id: string
          codigo: string
          created_at?: string
          descricao: string
          id?: string
          observacao?: string | null
          responsavel?: string | null
          safra_id: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          centro_custo_id?: string
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          observacao?: string | null
          responsavel?: string | null
          safra_id?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_orcamento_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_orcamento_safra_id_fkey"
            columns: ["safra_id"]
            isOneToOne: false
            referencedRelation: "safra"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_mensal: {
        Row: {
          competencia: string
          id: string
          item_orcamento_id: string
          valor: number
        }
        Insert: {
          competencia: string
          id?: string
          item_orcamento_id: string
          valor?: number
        }
        Update: {
          competencia?: string
          id?: string
          item_orcamento_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_mensal_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "item_orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_mensal_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_acumulado"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "orcamento_mensal_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_mes"
            referencedColumns: ["item_id"]
          },
        ]
      }
      orcamento_revisao: {
        Row: {
          competencia: string
          created_at: string
          id: string
          item_orcamento_id: string
          motivo: string
          usuario: string | null
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          competencia: string
          created_at?: string
          id?: string
          item_orcamento_id: string
          motivo: string
          usuario?: string | null
          valor_anterior: number
          valor_novo: number
        }
        Update: {
          competencia?: string
          created_at?: string
          id?: string
          item_orcamento_id?: string
          motivo?: string
          usuario?: string | null
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_revisao_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "item_orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_revisao_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_acumulado"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "orcamento_revisao_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_mes"
            referencedColumns: ["item_id"]
          },
        ]
      }
      realizado: {
        Row: {
          centro_custo_id: string | null
          chave_rm: string | null
          codigo_cc_origem: string
          competencia: string
          conta_contabil: string | null
          created_at: string
          data_lancamento: string
          documento: string | null
          historico: string | null
          id: string
          importacao_id: string | null
          item_orcamento_id: string | null
          safra_id: string
          valor: number
        }
        Insert: {
          centro_custo_id?: string | null
          chave_rm?: string | null
          codigo_cc_origem: string
          competencia: string
          conta_contabil?: string | null
          created_at?: string
          data_lancamento: string
          documento?: string | null
          historico?: string | null
          id?: string
          importacao_id?: string | null
          item_orcamento_id?: string | null
          safra_id: string
          valor: number
        }
        Update: {
          centro_custo_id?: string | null
          chave_rm?: string | null
          codigo_cc_origem?: string
          competencia?: string
          conta_contabil?: string | null
          created_at?: string
          data_lancamento?: string
          documento?: string | null
          historico?: string | null
          id?: string
          importacao_id?: string | null
          item_orcamento_id?: string | null
          safra_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "realizado_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centro_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "item_orcamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realizado_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_acumulado"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "realizado_item_orcamento_id_fkey"
            columns: ["item_orcamento_id"]
            isOneToOne: false
            referencedRelation: "v_item_mes"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "realizado_safra_id_fkey"
            columns: ["safra_id"]
            isOneToOne: false
            referencedRelation: "safra"
            referencedColumns: ["id"]
          },
        ]
      }
      safra: {
        Row: {
          data_fim: string
          data_inicio: string
          id: string
          status: string
        }
        Insert: {
          data_fim: string
          data_inicio: string
          id: string
          status?: string
        }
        Update: {
          data_fim?: string
          data_inicio?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_item_acumulado: {
        Row: {
          atividade: string | null
          centro_custo: string | null
          codigo: string | null
          codigo_rm: string | null
          comprometido: number | null
          farol: string | null
          item: string | null
          item_id: string | null
          orcado: number | null
          pct_execucao: number | null
          realizado: number | null
          responsavel: string | null
          safra_id: string | null
          saldo: number | null
          status: string | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_orcamento_safra_id_fkey"
            columns: ["safra_id"]
            isOneToOne: false
            referencedRelation: "safra"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_mes: {
        Row: {
          atividade: string | null
          centro_custo: string | null
          codigo: string | null
          codigo_rm: string | null
          competencia: string | null
          desvio: number | null
          item: string | null
          item_id: string | null
          orcado: number | null
          pct_execucao: number | null
          realizado: number | null
          safra_id: string | null
          status: string | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_orcamento_safra_id_fkey"
            columns: ["safra_id"]
            isOneToOne: false
            referencedRelation: "safra"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pendencias: {
        Row: {
          codigo_cc_origem: string | null
          conta_contabil: string | null
          data_lancamento: string | null
          documento: string | null
          historico: string | null
          id: string | null
          motivo: string | null
          valor: number | null
        }
        Insert: {
          codigo_cc_origem?: string | null
          conta_contabil?: string | null
          data_lancamento?: string | null
          documento?: string | null
          historico?: string | null
          id?: string | null
          motivo?: never
          valor?: number | null
        }
        Update: {
          codigo_cc_origem?: string | null
          conta_contabil?: string | null
          data_lancamento?: string | null
          documento?: string | null
          historico?: string | null
          id?: string | null
          motivo?: never
          valor?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      f_cc_acumulado: {
        Args: { p_safra_id: string }
        Returns: {
          atividade: string
          centro_custo: string
          centro_custo_id: string
          codigo_rm: string
          orcado: number
          pct_execucao: number
          realizado: number
          saldo: number
        }[]
      }
      f_curva_mensal: {
        Args: { p_safra_id: string }
        Returns: {
          competencia: string
          orcado_acum: number
          orcado_mes: number
          realizado_acum: number
          realizado_mes: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
