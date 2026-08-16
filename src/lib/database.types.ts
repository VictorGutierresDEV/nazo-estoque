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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          campo: string | null
          comentario: string | null
          criado_em: string | null
          evento: string
          id: string
          registro_id: string
          tabela: string
          unidade_id: string
          user_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo?: string | null
          comentario?: string | null
          criado_em?: string | null
          evento?: string
          id?: string
          registro_id: string
          tabela: string
          unidade_id?: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string | null
          comentario?: string | null
          criado_em?: string | null
          evento?: string
          id?: string
          registro_id?: string
          tabela?: string
          unidade_id?: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_shared_state: {
        Row: {
          key: string
          unidade_id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          unidade_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          unidade_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_shared_state_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_shared_state_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_items: {
        Row: {
          area: string
          area_code: string | null
          audit_id: string
          comentario: string | null
          criado_em: string | null
          id: string
          imagens: string[] | null
          item: string
          item_code: string | null
          ocorrencias: number
          peso: number
          reincidente: boolean
          resposta: string
          resposta_raw: string | null
          sugestao: string | null
          tratativa: string | null
          tratativa_em: string | null
          tratativa_obs: string | null
          tratativa_por: string | null
          unidade_id: string
        }
        Insert: {
          area?: string
          area_code?: string | null
          audit_id: string
          comentario?: string | null
          criado_em?: string | null
          id?: string
          imagens?: string[] | null
          item: string
          item_code?: string | null
          ocorrencias?: number
          peso?: number
          reincidente?: boolean
          resposta: string
          resposta_raw?: string | null
          sugestao?: string | null
          tratativa?: string | null
          tratativa_em?: string | null
          tratativa_obs?: string | null
          tratativa_por?: string | null
          unidade_id?: string
        }
        Update: {
          area?: string
          area_code?: string | null
          audit_id?: string
          comentario?: string | null
          criado_em?: string | null
          id?: string
          imagens?: string[] | null
          item?: string
          item_code?: string | null
          ocorrencias?: number
          peso?: number
          reincidente?: boolean
          resposta?: string
          resposta_raw?: string | null
          sugestao?: string | null
          tratativa?: string | null
          tratativa_em?: string | null
          tratativa_obs?: string | null
          tratativa_por?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_items_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_items_tratativa_por_fkey"
            columns: ["tratativa_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_items_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_plan_notes: {
        Row: {
          criado_em: string | null
          criado_por: string | null
          id: string
          plan_id: string
          texto: string
          unidade_id: string
        }
        Insert: {
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          plan_id: string
          texto: string
          unidade_id?: string
        }
        Update: {
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          plan_id?: string
          texto?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_plan_notes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_plan_notes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "audit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_plan_notes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_plans: {
        Row: {
          acao: string
          area: string | null
          atualizado_em: string | null
          audit_id: string | null
          audit_item_id: string | null
          causa_detalhe: string | null
          causa_raiz: string | null
          checklist_name: string
          comprovado_em: string | null
          concluido_em: string | null
          criado_em: string | null
          criado_por: string | null
          evidencia: string | null
          id: string
          item_code: string | null
          item_texto: string
          media_urls: string[] | null
          peso: number
          prazo: string | null
          reaberto_em: string | null
          responsavel: string | null
          status: string
          unidade: string
          unidade_id: string
        }
        Insert: {
          acao: string
          area?: string | null
          atualizado_em?: string | null
          audit_id?: string | null
          audit_item_id?: string | null
          causa_detalhe?: string | null
          causa_raiz?: string | null
          checklist_name: string
          comprovado_em?: string | null
          concluido_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          evidencia?: string | null
          id?: string
          item_code?: string | null
          item_texto: string
          media_urls?: string[] | null
          peso?: number
          prazo?: string | null
          reaberto_em?: string | null
          responsavel?: string | null
          status?: string
          unidade: string
          unidade_id?: string
        }
        Update: {
          acao?: string
          area?: string | null
          atualizado_em?: string | null
          audit_id?: string | null
          audit_item_id?: string | null
          causa_detalhe?: string | null
          causa_raiz?: string | null
          checklist_name?: string
          comprovado_em?: string | null
          concluido_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          evidencia?: string | null
          id?: string
          item_code?: string | null
          item_texto?: string
          media_urls?: string[] | null
          peso?: number
          prazo?: string | null
          reaberto_em?: string | null
          responsavel?: string | null
          status?: string
          unidade?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_plans_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_plans_audit_item_id_fkey"
            columns: ["audit_item_id"]
            isOneToOne: false
            referencedRelation: "audit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_plans_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_plans_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_resources: {
        Row: {
          criado_em: string | null
          criado_por: string | null
          decidido_em: string | null
          decidido_por: string | null
          descricao: string
          id: string
          justificativa_decisao: string | null
          plan_id: string
          status: string
          tipo: string
          unidade_id: string
          valor_estimado: number | null
        }
        Insert: {
          criado_em?: string | null
          criado_por?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          descricao: string
          id?: string
          justificativa_decisao?: string | null
          plan_id: string
          status?: string
          tipo?: string
          unidade_id?: string
          valor_estimado?: number | null
        }
        Update: {
          criado_em?: string | null
          criado_por?: string | null
          decidido_em?: string | null
          decidido_por?: string | null
          descricao?: string
          id?: string
          justificativa_decisao?: string | null
          plan_id?: string
          status?: string
          tipo?: string
          unidade_id?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_resources_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_resources_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_resources_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "audit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_resources_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_settings: {
        Row: {
          atualizado_em: string | null
          checklist_name: string
          meta: number
        }
        Insert: {
          atualizado_em?: string | null
          checklist_name: string
          meta?: number
        }
        Update: {
          atualizado_em?: string | null
          checklist_name?: string
          meta?: number
        }
        Relationships: []
      }
      audits: {
        Row: {
          checklist_code: string | null
          checklist_name: string
          criado_em: string | null
          evaluation_code: string
          finished_at: string | null
          id: string
          itens_na: number
          itens_nao: number
          itens_sim: number
          meta: number
          peso_perdido: number
          peso_total: number
          score: number | null
          started_at: string | null
          supervisor: string | null
          total_itens: number
          unidade: string
          unidade_id: string
          uploaded_by: string | null
        }
        Insert: {
          checklist_code?: string | null
          checklist_name: string
          criado_em?: string | null
          evaluation_code: string
          finished_at?: string | null
          id?: string
          itens_na?: number
          itens_nao?: number
          itens_sim?: number
          meta?: number
          peso_perdido?: number
          peso_total?: number
          score?: number | null
          started_at?: string | null
          supervisor?: string | null
          total_itens?: number
          unidade: string
          unidade_id?: string
          uploaded_by?: string | null
        }
        Update: {
          checklist_code?: string | null
          checklist_name?: string
          criado_em?: string | null
          evaluation_code?: string
          finished_at?: string | null
          id?: string
          itens_na?: number
          itens_nao?: number
          itens_sim?: number
          meta?: number
          peso_perdido?: number
          peso_total?: number
          score?: number | null
          started_at?: string | null
          supervisor?: string | null
          total_itens?: number
          unidade?: string
          unidade_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audits_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_alertas: {
        Row: {
          adiar_ate: string | null
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          colaborador_id: string | null
          resolucao: string | null
          status: string
          unidade_id: string
        }
        Insert: {
          adiar_ate?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          colaborador_id?: string | null
          resolucao?: string | null
          status?: string
          unidade_id?: string
        }
        Update: {
          adiar_ate?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          colaborador_id?: string | null
          resolucao?: string | null
          status?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_alertas_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_alertas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_alertas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_auditoria: {
        Row: {
          acao: string
          autor: string | null
          campo: string | null
          colaborador_id: string | null
          criado_em: string
          detalhe: string | null
          id: string
          origem: string | null
          unidade_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao: string
          autor?: string | null
          campo?: string | null
          colaborador_id?: string | null
          criado_em?: string
          detalhe?: string | null
          id?: string
          origem?: string | null
          unidade_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          autor?: string | null
          campo?: string | null
          colaborador_id?: string | null
          criado_em?: string
          detalhe?: string | null
          id?: string
          origem?: string | null
          unidade_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_auditoria_autor_fkey"
            columns: ["autor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_auditoria_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_auditoria_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_config: {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          cidade: string | null
          dias_aviso_aniversario: number
          dias_aviso_primeiro: number
          dias_aviso_segundo: number
          empresa_cnpj: string | null
          empresa_nome: string | null
          mensagem_aniversario_modelo: string | null
          politica_folga_aniversario: boolean
          responsavel_cargo: string | null
          responsavel_nome: string | null
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          cidade?: string | null
          dias_aviso_aniversario?: number
          dias_aviso_primeiro?: number
          dias_aviso_segundo?: number
          empresa_cnpj?: string | null
          empresa_nome?: string | null
          mensagem_aniversario_modelo?: string | null
          politica_folga_aniversario?: boolean
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
          unidade_id: string
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          cidade?: string | null
          dias_aviso_aniversario?: number
          dias_aviso_primeiro?: number
          dias_aviso_segundo?: number
          empresa_cnpj?: string | null
          empresa_nome?: string | null
          mensagem_aniversario_modelo?: string | null
          politica_folga_aniversario?: boolean
          responsavel_cargo?: string | null
          responsavel_nome?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_config_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_config_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_decisoes: {
        Row: {
          colaborador_id: string
          decidido_em: string
          decidido_por: string | null
          decisao: string
          id: string
          observacao: string | null
          periodo: string
          unidade_id: string
        }
        Insert: {
          colaborador_id: string
          decidido_em?: string
          decidido_por?: string | null
          decisao: string
          id?: string
          observacao?: string | null
          periodo: string
          unidade_id?: string
        }
        Update: {
          colaborador_id?: string
          decidido_em?: string
          decidido_por?: string | null
          decisao?: string
          id?: string
          observacao?: string | null
          periodo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_decisoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_decisoes_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_decisoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_documentos: {
        Row: {
          colaborador_id: string
          corpo: string
          dados: Json | null
          gerado_em: string
          gerado_por: string | null
          id: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          colaborador_id: string
          corpo: string
          dados?: Json | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          tipo?: string
          unidade_id?: string
        }
        Update: {
          colaborador_id?: string
          corpo?: string
          dados?: Json | null
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_documentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_documentos_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_folgas: {
        Row: {
          agendada_em: string | null
          agendada_por: string | null
          aprovada_em: string | null
          aprovada_por: string | null
          atualizado_em: string | null
          colaborador_id: string
          competencia: string
          criado_em: string | null
          data_prevista: string | null
          fora_da_competencia: boolean
          id: string
          justificativa_excecao: string | null
          observacao: string | null
          status: string
          unidade_id: string
        }
        Insert: {
          agendada_em?: string | null
          agendada_por?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atualizado_em?: string | null
          colaborador_id: string
          competencia: string
          criado_em?: string | null
          data_prevista?: string | null
          fora_da_competencia?: boolean
          id?: string
          justificativa_excecao?: string | null
          observacao?: string | null
          status?: string
          unidade_id?: string
        }
        Update: {
          agendada_em?: string | null
          agendada_por?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atualizado_em?: string | null
          colaborador_id?: string
          competencia?: string
          criado_em?: string | null
          data_prevista?: string | null
          fora_da_competencia?: boolean
          id?: string
          justificativa_excecao?: string | null
          observacao?: string | null
          status?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_folgas_agendada_por_fkey"
            columns: ["agendada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_folgas_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_folgas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_folgas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_mensagens: {
        Row: {
          canal: string
          colaborador_id: string
          competencia: string
          enviado_em: string
          enviado_por: string | null
          id: string
          texto: string
          unidade_id: string
        }
        Insert: {
          canal?: string
          colaborador_id: string
          competencia: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          texto: string
          unidade_id?: string
        }
        Update: {
          canal?: string
          colaborador_id?: string
          competencia?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          texto?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_mensagens_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_mensagens_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_mensagens_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          cargo: string | null
          contrato_encerrado_em: string | null
          cpf: string
          criado_em: string | null
          criado_por: string | null
          data_admissao: string
          data_desligamento: string | null
          data_nascimento: string | null
          email: string | null
          exp_primeiro_decidido_em: string | null
          exp_primeiro_decidido_por: string | null
          exp_primeiro_decisao: string | null
          exp_renovacao_confirmada_em: string | null
          exp_renovacao_confirmada_por: string | null
          exp_segundo_decidido_em: string | null
          exp_segundo_decidido_por: string | null
          exp_segundo_decisao: string | null
          experiencia_dispensada: boolean
          id: string
          local_trabalho: string | null
          matricula: string | null
          nome_completo: string
          nome_mae: string | null
          observacoes: string | null
          profile_id: string | null
          setor: string | null
          status: string
          telefone: string | null
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          cargo?: string | null
          contrato_encerrado_em?: string | null
          cpf: string
          criado_em?: string | null
          criado_por?: string | null
          data_admissao: string
          data_desligamento?: string | null
          data_nascimento?: string | null
          email?: string | null
          exp_primeiro_decidido_em?: string | null
          exp_primeiro_decidido_por?: string | null
          exp_primeiro_decisao?: string | null
          exp_renovacao_confirmada_em?: string | null
          exp_renovacao_confirmada_por?: string | null
          exp_segundo_decidido_em?: string | null
          exp_segundo_decidido_por?: string | null
          exp_segundo_decisao?: string | null
          experiencia_dispensada?: boolean
          id?: string
          local_trabalho?: string | null
          matricula?: string | null
          nome_completo: string
          nome_mae?: string | null
          observacoes?: string | null
          profile_id?: string | null
          setor?: string | null
          status?: string
          telefone?: string | null
          unidade_id?: string
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          cargo?: string | null
          contrato_encerrado_em?: string | null
          cpf?: string
          criado_em?: string | null
          criado_por?: string | null
          data_admissao?: string
          data_desligamento?: string | null
          data_nascimento?: string | null
          email?: string | null
          exp_primeiro_decidido_em?: string | null
          exp_primeiro_decidido_por?: string | null
          exp_primeiro_decisao?: string | null
          exp_renovacao_confirmada_em?: string | null
          exp_renovacao_confirmada_por?: string | null
          exp_segundo_decidido_em?: string | null
          exp_segundo_decidido_por?: string | null
          exp_segundo_decisao?: string | null
          experiencia_dispensada?: boolean
          id?: string
          local_trabalho?: string | null
          matricula?: string | null
          nome_completo?: string
          nome_mae?: string | null
          observacoes?: string | null
          profile_id?: string | null
          setor?: string | null
          status?: string
          telefone?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_exp_primeiro_decidido_por_fkey"
            columns: ["exp_primeiro_decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_exp_renovacao_confirmada_por_fkey"
            columns: ["exp_renovacao_confirmada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_exp_segundo_decidido_por_fkey"
            columns: ["exp_segundo_decidido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefings: {
        Row: {
          acao_imediata: string | null
          atualizado_em: string | null
          cardapio_conferido: boolean | null
          criado_em: string | null
          data: string
          id: string
          itens_baixa: Json | null
          itens_indisponiveis_plataforma: Json | null
          lider_plantao: string | null
          maquinas_cartao_ok: boolean | null
          organizacao_regular: boolean | null
          pendencias: Json | null
          plataforma_ifood: boolean | null
          plataforma_outras: string | null
          plataforma_telefone: boolean | null
          plataforma_whatsapp: boolean | null
          pop_almoco: number | null
          pop_almoco_freelas: number | null
          pop_almoco_freelas_meio: number
          pop_jantar: number | null
          pop_jantar_freelas: number | null
          pop_jantar_freelas_meio: number
          problema_impactante: string | null
          produtos_vencimento: Json | null
          publicado_por: string | null
          reservas_almoco: number | null
          reservas_jantar: number | null
          reservas_obs: string | null
          responsavel_acao: string | null
          responsavel_caixa: string | null
          rupturas: Json | null
          rupturas_delivery: Json | null
          setor: string
          tempo_medio_entrega: number | null
          troco_disponivel: boolean | null
          ultima_limpeza_data: string | null
          ultima_limpeza_responsavel: string | null
          unidade_id: string
          validacao: string
          validacao_nota: string | null
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          acao_imediata?: string | null
          atualizado_em?: string | null
          cardapio_conferido?: boolean | null
          criado_em?: string | null
          data?: string
          id?: string
          itens_baixa?: Json | null
          itens_indisponiveis_plataforma?: Json | null
          lider_plantao?: string | null
          maquinas_cartao_ok?: boolean | null
          organizacao_regular?: boolean | null
          pendencias?: Json | null
          plataforma_ifood?: boolean | null
          plataforma_outras?: string | null
          plataforma_telefone?: boolean | null
          plataforma_whatsapp?: boolean | null
          pop_almoco?: number | null
          pop_almoco_freelas?: number | null
          pop_almoco_freelas_meio?: number
          pop_jantar?: number | null
          pop_jantar_freelas?: number | null
          pop_jantar_freelas_meio?: number
          problema_impactante?: string | null
          produtos_vencimento?: Json | null
          publicado_por?: string | null
          reservas_almoco?: number | null
          reservas_jantar?: number | null
          reservas_obs?: string | null
          responsavel_acao?: string | null
          responsavel_caixa?: string | null
          rupturas?: Json | null
          rupturas_delivery?: Json | null
          setor: string
          tempo_medio_entrega?: number | null
          troco_disponivel?: boolean | null
          ultima_limpeza_data?: string | null
          ultima_limpeza_responsavel?: string | null
          unidade_id?: string
          validacao?: string
          validacao_nota?: string | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          acao_imediata?: string | null
          atualizado_em?: string | null
          cardapio_conferido?: boolean | null
          criado_em?: string | null
          data?: string
          id?: string
          itens_baixa?: Json | null
          itens_indisponiveis_plataforma?: Json | null
          lider_plantao?: string | null
          maquinas_cartao_ok?: boolean | null
          organizacao_regular?: boolean | null
          pendencias?: Json | null
          plataforma_ifood?: boolean | null
          plataforma_outras?: string | null
          plataforma_telefone?: boolean | null
          plataforma_whatsapp?: boolean | null
          pop_almoco?: number | null
          pop_almoco_freelas?: number | null
          pop_almoco_freelas_meio?: number
          pop_jantar?: number | null
          pop_jantar_freelas?: number | null
          pop_jantar_freelas_meio?: number
          problema_impactante?: string | null
          produtos_vencimento?: Json | null
          publicado_por?: string | null
          reservas_almoco?: number | null
          reservas_jantar?: number | null
          reservas_obs?: string | null
          responsavel_acao?: string | null
          responsavel_caixa?: string | null
          rupturas?: Json | null
          rupturas_delivery?: Json | null
          setor?: string
          tempo_medio_entrega?: number | null
          troco_disponivel?: boolean | null
          ultima_limpeza_data?: string | null
          ultima_limpeza_responsavel?: string | null
          unidade_id?: string
          validacao?: string
          validacao_nota?: string | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_briefings_publicado_por_fkey"
            columns: ["publicado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_briefings_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_briefings_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_pillars: {
        Row: {
          atrasos: string | null
          atualizado_em: string | null
          canal_confirmacao: string | null
          checklist_dificil: string | null
          checklist_pendente: string | null
          criado_em: string | null
          data: string
          escala_min_quadros: Json | null
          escala_min_verificado: boolean
          escala_minima: Json | null
          escala_minima_observacoes: string | null
          escaladas: number | null
          estoque_baixos: Json | null
          estoque_pendente: string | null
          fechamento_risco: string | null
          id: string
          manutencao_em_reparo: string | null
          manutencao_reportado: boolean | null
          nota_final: string | null
          obs_gerais: string | null
          plano_b_acao: string | null
          plano_tatico: Json | null
          plano_tatico_observacao: string | null
          pop_batido: boolean | null
          pop_motivo: string | null
          pop_observacao: string | null
          pop_status: string | null
          preenchido_por: string | null
          presenca_confirmada: boolean | null
          previstas: number | null
          reclamacoes_detalhe: string | null
          reclamacoes_houve: boolean | null
          requisicao_feita: boolean | null
          requisicao_pendente: string | null
          score_calculado: number | null
          tempo_prato: string | null
          unidade_id: string
        }
        Insert: {
          atrasos?: string | null
          atualizado_em?: string | null
          canal_confirmacao?: string | null
          checklist_dificil?: string | null
          checklist_pendente?: string | null
          criado_em?: string | null
          data?: string
          escala_min_quadros?: Json | null
          escala_min_verificado?: boolean
          escala_minima?: Json | null
          escala_minima_observacoes?: string | null
          escaladas?: number | null
          estoque_baixos?: Json | null
          estoque_pendente?: string | null
          fechamento_risco?: string | null
          id?: string
          manutencao_em_reparo?: string | null
          manutencao_reportado?: boolean | null
          nota_final?: string | null
          obs_gerais?: string | null
          plano_b_acao?: string | null
          plano_tatico?: Json | null
          plano_tatico_observacao?: string | null
          pop_batido?: boolean | null
          pop_motivo?: string | null
          pop_observacao?: string | null
          pop_status?: string | null
          preenchido_por?: string | null
          presenca_confirmada?: boolean | null
          previstas?: number | null
          reclamacoes_detalhe?: string | null
          reclamacoes_houve?: boolean | null
          requisicao_feita?: boolean | null
          requisicao_pendente?: string | null
          score_calculado?: number | null
          tempo_prato?: string | null
          unidade_id?: string
        }
        Update: {
          atrasos?: string | null
          atualizado_em?: string | null
          canal_confirmacao?: string | null
          checklist_dificil?: string | null
          checklist_pendente?: string | null
          criado_em?: string | null
          data?: string
          escala_min_quadros?: Json | null
          escala_min_verificado?: boolean
          escala_minima?: Json | null
          escala_minima_observacoes?: string | null
          escaladas?: number | null
          estoque_baixos?: Json | null
          estoque_pendente?: string | null
          fechamento_risco?: string | null
          id?: string
          manutencao_em_reparo?: string | null
          manutencao_reportado?: boolean | null
          nota_final?: string | null
          obs_gerais?: string | null
          plano_b_acao?: string | null
          plano_tatico?: Json | null
          plano_tatico_observacao?: string | null
          pop_batido?: boolean | null
          pop_motivo?: string | null
          pop_observacao?: string | null
          pop_status?: string | null
          preenchido_por?: string | null
          presenca_confirmada?: boolean | null
          previstas?: number | null
          reclamacoes_detalhe?: string | null
          reclamacoes_houve?: boolean | null
          requisicao_feita?: boolean | null
          requisicao_pendente?: string | null
          score_calculado?: number | null
          tempo_prato?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_pillars_preenchido_por_fkey"
            columns: ["preenchido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_pillars_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_priorities: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          data: string
          descricao: string | null
          id: string
          prioridade: string
          responsavel_id: string | null
          setor: string
          status: string
          titulo: string
          unidade_id: string
          visibilidade: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          prioridade?: string
          responsavel_id?: string | null
          setor?: string
          status?: string
          titulo: string
          unidade_id?: string
          visibilidade?: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          prioridade?: string
          responsavel_id?: string | null
          setor?: string
          status?: string
          titulo?: string
          unidade_id?: string
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_priorities_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_priorities_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_priorities_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          criado_em: string | null
          data: string
          id: string
          observacoes: string | null
          rupturas_reportadas: number | null
          turno: string
          unidade_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          rupturas_reportadas?: number | null
          turno: string
          unidade_id?: string
          user_id: string
        }
        Update: {
          criado_em?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          rupturas_reportadas?: number | null
          turno?: string
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_closings: {
        Row: {
          atualizado_em: string | null
          briefings_com_ressalva: number
          briefings_conferidos: number
          briefings_devolvidos: number
          briefings_esperados: number
          criado_em: string | null
          data: string
          divergencias: Json
          fechado_em: string | null
          fechado_por: string | null
          id: string
          observacao: string | null
          unidade_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          briefings_com_ressalva?: number
          briefings_conferidos?: number
          briefings_devolvidos?: number
          briefings_esperados?: number
          criado_em?: string | null
          data: string
          divergencias?: Json
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          unidade_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          briefings_com_ressalva?: number
          briefings_conferidos?: number
          briefings_devolvidos?: number
          briefings_esperados?: number
          criado_em?: string | null
          data?: string
          divergencias?: Json
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_closings_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_closings_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          email: string
          enviado_em: string | null
          erro: string | null
          id: string
          provider_id: string | null
          status: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          email: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          provider_id?: string | null
          status: string
          tipo?: string
          user_id?: string | null
        }
        Update: {
          email?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          provider_id?: string | null
          status?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_lancamentos: {
        Row: {
          created_at: string
          custo_unitario: number
          delta: number
          id: string
          praca_id: string | null
          produto_id: string
          transacao_id: string
          unidade_id: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          delta: number
          id?: string
          praca_id?: string | null
          produto_id: string
          transacao_id: string
          unidade_id: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          delta?: number
          id?: string
          praca_id?: string | null
          produto_id?: string
          transacao_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_lancamentos_praca_id_fkey"
            columns: ["praca_id"]
            isOneToOne: false
            referencedRelation: "estoque_pracas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lancamentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "estoque_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lancamentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "estoque_extrato"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "estoque_lancamentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "estoque_transacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lancamentos_unidade_fk"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_pracas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_pracas_unidade_fk"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          custo_medio: number
          ean: string | null
          estoque_minimo: number
          id: string
          nome: string
          unidade_id: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_medio?: number
          ean?: string | null
          estoque_minimo?: number
          id?: string
          nome: string
          unidade_id: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_medio?: number
          ean?: string | null
          estoque_minimo?: number
          id?: string
          nome?: string
          unidade_id?: string
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_produtos_unidade_fk"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_transacoes: {
        Row: {
          created_at: string
          documento: string | null
          estorno_de: string | null
          fornecedor: string | null
          id: string
          motivo: string | null
          observacao: string | null
          ocorrido_em: string
          praca_id: string | null
          registrado_por: string
          retirado_por: string | null
          tipo: string
          unidade_id: string
        }
        Insert: {
          created_at?: string
          documento?: string | null
          estorno_de?: string | null
          fornecedor?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          ocorrido_em?: string
          praca_id?: string | null
          registrado_por: string
          retirado_por?: string | null
          tipo: string
          unidade_id: string
        }
        Update: {
          created_at?: string
          documento?: string | null
          estorno_de?: string | null
          fornecedor?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          ocorrido_em?: string
          praca_id?: string | null
          registrado_por?: string
          retirado_por?: string | null
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_transacoes_estorno_de_fkey"
            columns: ["estorno_de"]
            isOneToOne: false
            referencedRelation: "estoque_extrato"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "estoque_transacoes_estorno_de_fkey"
            columns: ["estorno_de"]
            isOneToOne: false
            referencedRelation: "estoque_transacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_transacoes_praca_id_fkey"
            columns: ["praca_id"]
            isOneToOne: false
            referencedRelation: "estoque_pracas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_transacoes_retirado_por_fk"
            columns: ["retirado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_transacoes_unidade_fk"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          comprovante_urls: string[] | null
          criado_em: string | null
          criado_por: string | null
          dados_pagamento: string | null
          data_envio: string | null
          data_pagamento: string | null
          data_prevista: string | null
          data_vencimento: string | null
          descricao: string | null
          documento: string | null
          favorecido: string | null
          forma_pagamento: string | null
          id: string
          maintenance_id: string | null
          motivo_pendencia: string | null
          observacoes: string | null
          responsavel_envio: string | null
          setor: string
          status: string
          tipo: string
          titulo: string
          unidade_id: string
          valor: number | null
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          comprovante_urls?: string[] | null
          criado_em?: string | null
          criado_por?: string | null
          dados_pagamento?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          documento?: string | null
          favorecido?: string | null
          forma_pagamento?: string | null
          id?: string
          maintenance_id?: string | null
          motivo_pendencia?: string | null
          observacoes?: string | null
          responsavel_envio?: string | null
          setor?: string
          status?: string
          tipo?: string
          titulo: string
          unidade_id?: string
          valor?: number | null
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          comprovante_urls?: string[] | null
          criado_em?: string | null
          criado_por?: string | null
          dados_pagamento?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          documento?: string | null
          favorecido?: string | null
          forma_pagamento?: string | null
          id?: string
          maintenance_id?: string | null
          motivo_pendencia?: string | null
          observacoes?: string | null
          responsavel_envio?: string | null
          setor?: string
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_responsavel_envio_fkey"
            columns: ["responsavel_envio"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_announcements: {
        Row: {
          atualizado_em: string | null
          cargo: string | null
          colaborador_nome: string | null
          criado_em: string | null
          data_evento: string | null
          data_fim: string | null
          descricao: string | null
          id: string
          media_urls: string[] | null
          publicado_por: string | null
          status: string
          tipo: string
          titulo: string
          unidade_id: string
          valor: number | null
          visibilidade: string
        }
        Insert: {
          atualizado_em?: string | null
          cargo?: string | null
          colaborador_nome?: string | null
          criado_em?: string | null
          data_evento?: string | null
          data_fim?: string | null
          descricao?: string | null
          id?: string
          media_urls?: string[] | null
          publicado_por?: string | null
          status?: string
          tipo: string
          titulo: string
          unidade_id?: string
          valor?: number | null
          visibilidade?: string
        }
        Update: {
          atualizado_em?: string | null
          cargo?: string | null
          colaborador_nome?: string | null
          criado_em?: string | null
          data_evento?: string | null
          data_fim?: string | null
          descricao?: string | null
          id?: string
          media_urls?: string[] | null
          publicado_por?: string | null
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string
          valor?: number | null
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_announcements_publicado_por_fkey"
            columns: ["publicado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_announcements_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          data_devolucao: string | null
          data_emprestimo: string | null
          direcao: string
          id: string
          item: string
          observacao: string | null
          previsao_devolucao: string | null
          quantidade: string | null
          quem_pediu_transporte: string | null
          restaurante: string
          solicitante: string | null
          status: string
          tipo_produto: string | null
          transporte: string | null
          unidade_contraparte_id: string | null
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_devolucao?: string | null
          data_emprestimo?: string | null
          direcao?: string
          id?: string
          item: string
          observacao?: string | null
          previsao_devolucao?: string | null
          quantidade?: string | null
          quem_pediu_transporte?: string | null
          restaurante: string
          solicitante?: string | null
          status?: string
          tipo_produto?: string | null
          transporte?: string | null
          unidade_contraparte_id?: string | null
          unidade_id?: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_devolucao?: string | null
          data_emprestimo?: string | null
          direcao?: string
          id?: string
          item?: string
          observacao?: string | null
          previsao_devolucao?: string | null
          quantidade?: string | null
          quem_pediu_transporte?: string | null
          restaurante?: string
          solicitante?: string | null
          status?: string
          tipo_produto?: string | null
          transporte?: string | null
          unidade_contraparte_id?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_unidade_contraparte_id_fkey"
            columns: ["unidade_contraparte_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          atualizado_em: string | null
          categoria: string
          criado_em: string | null
          criado_por: string | null
          custo: number | null
          custo_status: string
          data_conclusao: string | null
          data_envio_financeiro: string | null
          data_pagamento: string | null
          data_prevista: string | null
          descricao: string | null
          enviado_financeiro: boolean
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          local: string | null
          media_urls: string[] | null
          motivo_pendencia: string | null
          observacoes: string | null
          prioridade: string
          responsavel: string | null
          setor: string
          status: string
          titulo: string
          ultima_manutencao: string | null
          unidade_id: string
          valor_final: number | null
        }
        Insert: {
          atualizado_em?: string | null
          categoria?: string
          criado_em?: string | null
          criado_por?: string | null
          custo?: number | null
          custo_status?: string
          data_conclusao?: string | null
          data_envio_financeiro?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          descricao?: string | null
          enviado_financeiro?: boolean
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          local?: string | null
          media_urls?: string[] | null
          motivo_pendencia?: string | null
          observacoes?: string | null
          prioridade?: string
          responsavel?: string | null
          setor?: string
          status?: string
          titulo: string
          ultima_manutencao?: string | null
          unidade_id?: string
          valor_final?: number | null
        }
        Update: {
          atualizado_em?: string | null
          categoria?: string
          criado_em?: string | null
          criado_por?: string | null
          custo?: number | null
          custo_status?: string
          data_conclusao?: string | null
          data_envio_financeiro?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          descricao?: string | null
          enviado_financeiro?: boolean
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          local?: string | null
          media_urls?: string[] | null
          motivo_pendencia?: string | null
          observacoes?: string | null
          prioridade?: string
          responsavel?: string | null
          setor?: string
          status?: string
          titulo?: string
          ultima_manutencao?: string | null
          unidade_id?: string
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_agenda: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          data: string
          descricao: string | null
          hora: string | null
          id: string
          media_urls: string[] | null
          observacoes: string | null
          prioridade: string
          reagendada_para: string | null
          responsavel_id: string | null
          setor: string
          status: string
          tipo: string
          titulo: string
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data: string
          descricao?: string | null
          hora?: string | null
          id?: string
          media_urls?: string[] | null
          observacoes?: string | null
          prioridade?: string
          reagendada_para?: string | null
          responsavel_id?: string | null
          setor?: string
          status?: string
          tipo?: string
          titulo: string
          unidade_id?: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data?: string
          descricao?: string | null
          hora?: string | null
          id?: string
          media_urls?: string[] | null
          observacoes?: string | null
          prioridade?: string
          reagendada_para?: string | null
          responsavel_id?: string | null
          setor?: string
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_agenda_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_agenda_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_agenda_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_items: {
        Row: {
          concluido: boolean | null
          id: string
          item: string
          ordem: number | null
          task_id: string
          unidade_id: string
        }
        Insert: {
          concluido?: boolean | null
          id?: string
          item: string
          ordem?: number | null
          task_id: string
          unidade_id?: string
        }
        Update: {
          concluido?: boolean | null
          id?: string
          item?: string
          ordem?: number | null
          task_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_items_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          criado_em: string | null
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acesso_todas_unidades: boolean
          ativo: boolean
          avatar_url: string | null
          criado_em: string | null
          id: string
          last_seen_at: string | null
          nome: string
          push_subscription: Json | null
          role: string
          setor: string
          telefone: string | null
          tutorials_seen: string[]
          unidade_ativa: string | null
          unidade_id: string | null
        }
        Insert: {
          acesso_todas_unidades?: boolean
          ativo?: boolean
          avatar_url?: string | null
          criado_em?: string | null
          id: string
          last_seen_at?: string | null
          nome: string
          push_subscription?: Json | null
          role: string
          setor: string
          telefone?: string | null
          tutorials_seen?: string[]
          unidade_ativa?: string | null
          unidade_id?: string | null
        }
        Update: {
          acesso_todas_unidades?: boolean
          ativo?: boolean
          avatar_url?: string | null
          criado_em?: string | null
          id?: string
          last_seen_at?: string | null
          nome?: string
          push_subscription?: Json | null
          role?: string
          setor?: string
          telefone?: string | null
          tutorials_seen?: string[]
          unidade_ativa?: string | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unidade_ativa_fkey"
            columns: ["unidade_ativa"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          ativo: boolean
          atribuido_para: string | null
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          descricao: string | null
          dias_semana: number[]
          hora_limite: string | null
          id: string
          prioridade: string
          setor_destino: string
          tipo: string
          titulo: string
          unidade_id: string
        }
        Insert: {
          ativo?: boolean
          atribuido_para?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          dias_semana?: number[]
          hora_limite?: string | null
          id?: string
          prioridade?: string
          setor_destino?: string
          tipo?: string
          titulo: string
          unidade_id?: string
        }
        Update: {
          ativo?: boolean
          atribuido_para?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          dias_semana?: number[]
          hora_limite?: string | null
          id?: string
          prioridade?: string
          setor_destino?: string
          tipo?: string
          titulo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_atribuido_para_fkey"
            columns: ["atribuido_para"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          atualizado_em: string | null
          contato: string | null
          criado_em: string | null
          criado_por: string | null
          data_hora: string
          externa_id: string | null
          externa_payload: Json | null
          id: string
          nome: string
          observacoes: string | null
          ocasiao: string | null
          origem: string
          praca: number | null
          quantidade_pessoas: number
          status: string
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string | null
          contato?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora: string
          externa_id?: string | null
          externa_payload?: Json | null
          id?: string
          nome: string
          observacoes?: string | null
          ocasiao?: string | null
          origem?: string
          praca?: number | null
          quantidade_pessoas: number
          status?: string
          unidade_id?: string
        }
        Update: {
          atualizado_em?: string | null
          contato?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora?: string
          externa_id?: string | null
          externa_payload?: Json | null
          id?: string
          nome?: string
          observacoes?: string | null
          ocasiao?: string | null
          origem?: string
          praca?: number | null
          quantidade_pessoas?: number
          status?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      roteiro_ligacao: {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          criado_em: string | null
          data: string
          id: string
          nota: number | null
          obs_final: string | null
          respostas: Json
          secao_status: Json
          sem_reclamacao: boolean | null
          status_geral: string | null
          unidade: string
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string | null
          data: string
          id?: string
          nota?: number | null
          obs_final?: string | null
          respostas?: Json
          secao_status?: Json
          sem_reclamacao?: boolean | null
          status_geral?: string | null
          unidade?: string
          unidade_id?: string
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          criado_em?: string | null
          data?: string
          id?: string
          nota?: number | null
          obs_final?: string | null
          respostas?: Json
          secao_status?: Json
          sem_reclamacao?: boolean | null
          status_geral?: string | null
          unidade?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roteiro_ligacao_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roteiro_ligacao_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roteiro_ligacao_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      setor_verbas: {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          atualizado_por: string | null
          criado_em: string | null
          diaria_integral: number | null
          diaria_meio: number | null
          id: string
          reserva_percentual: number
          setor: string
          unidade_id: string | null
          verba_mensal: number | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          atualizado_por?: string | null
          criado_em?: string | null
          diaria_integral?: number | null
          diaria_meio?: number | null
          id?: string
          reserva_percentual?: number
          setor: string
          unidade_id?: string | null
          verba_mensal?: number | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          atualizado_por?: string | null
          criado_em?: string | null
          diaria_integral?: number | null
          diaria_meio?: number | null
          id?: string
          reserva_percentual?: number
          setor?: string
          unidade_id?: string | null
          verba_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "setor_verbas_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setor_verbas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_minimos: {
        Row: {
          almoco: Json
          atualizado_em: string | null
          composicao: string | null
          dobras: string | null
          id: string
          jantar: Json
          nome: string
          ordem: number
          pessoas_necessarias: string | null
          quadro: string
          setor_app: string
          unidade_id: string
          verba_freelas: number | null
          vigencia: string
        }
        Insert: {
          almoco?: Json
          atualizado_em?: string | null
          composicao?: string | null
          dobras?: string | null
          id?: string
          jantar?: Json
          nome: string
          ordem?: number
          pessoas_necessarias?: string | null
          quadro: string
          setor_app?: string
          unidade_id?: string
          verba_freelas?: number | null
          vigencia: string
        }
        Update: {
          almoco?: Json
          atualizado_em?: string | null
          composicao?: string | null
          dobras?: string | null
          id?: string
          jantar?: Json
          nome?: string
          ordem?: number
          pessoas_necessarias?: string | null
          quadro?: string
          setor_app?: string
          unidade_id?: string
          verba_freelas?: number | null
          vigencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_minimos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          autor_id: string | null
          conteudo: string
          criado_em: string | null
          id: string
          media_urls: string[] | null
          mencionados: string[]
          task_id: string
          tipo: string
          unidade_id: string
        }
        Insert: {
          autor_id?: string | null
          conteudo: string
          criado_em?: string | null
          id?: string
          media_urls?: string[] | null
          mencionados?: string[]
          task_id: string
          tipo?: string
          unidade_id?: string
        }
        Update: {
          autor_id?: string | null
          conteudo?: string
          criado_em?: string | null
          id?: string
          media_urls?: string[] | null
          mencionados?: string[]
          task_id?: string
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          atribuido_para: string | null
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          data_limite: string | null
          descricao: string | null
          id: string
          media_urls: string[] | null
          ocorrencia_data: string | null
          prioridade: string
          recorrente_id: string | null
          setor_destino: string
          status: string
          tipo: string
          titulo: string
          unidade_id: string
        }
        Insert: {
          atribuido_para?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_limite?: string | null
          descricao?: string | null
          id?: string
          media_urls?: string[] | null
          ocorrencia_data?: string | null
          prioridade?: string
          recorrente_id?: string | null
          setor_destino: string
          status?: string
          tipo: string
          titulo: string
          unidade_id?: string
        }
        Update: {
          atribuido_para?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_limite?: string | null
          descricao?: string | null
          id?: string
          media_urls?: string[] | null
          ocorrencia_data?: string | null
          prioridade?: string
          recorrente_id?: string | null
          setor_destino?: string
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_atribuido_para_fkey"
            columns: ["atribuido_para"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recorrente_id_fkey"
            columns: ["recorrente_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unavailable_items: {
        Row: {
          criado_em: string | null
          id: string
          nome: string
          observacao: string | null
          reportado_por: string | null
          resolvido: boolean
          resolvido_em: string | null
          resolvido_por: string | null
          setor: string
          severidade: string
          unidade_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          nome: string
          observacao?: string | null
          reportado_por?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          setor: string
          severidade?: string
          unidade_id?: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          reportado_por?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          setor?: string
          severidade?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unavailable_items_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unavailable_items_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unavailable_items_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          codigo: string
          criado_em: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          criado_em?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          criado_em?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      wc_matches: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          data_hora: string
          externa_id: string | null
          fase: string
          fonte: string
          grupo: string | null
          id: string
          impacto: string
          observacao: string | null
          placar_a: number | null
          placar_b: number | null
          status: string
          time_a: string
          time_b: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora: string
          externa_id?: string | null
          fase?: string
          fonte?: string
          grupo?: string | null
          id?: string
          impacto?: string
          observacao?: string | null
          placar_a?: number | null
          placar_b?: number | null
          status?: string
          time_a: string
          time_b: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora?: string
          externa_id?: string | null
          fase?: string
          fonte?: string
          grupo?: string | null
          id?: string
          impacto?: string
          observacao?: string | null
          placar_a?: number | null
          placar_b?: number | null
          status?: string
          time_a?: string
          time_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "wc_matches_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      estoque_extrato: {
        Row: {
          bucket_praca_id: string | null
          custo_unitario: number | null
          documento: string | null
          entrada: boolean | null
          estorno_de: string | null
          fornecedor: string | null
          motivo: string | null
          observacao: string | null
          ocorrido_em: string | null
          praca_nome: string | null
          produto_id: string | null
          produto_nome: string | null
          quantidade: number | null
          registrado_por: string | null
          retirado_por: string | null
          tipo: string | null
          transacao_id: string | null
          unidade_id: string | null
          unidade_medida: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_lancamentos_praca_id_fkey"
            columns: ["bucket_praca_id"]
            isOneToOne: false
            referencedRelation: "estoque_pracas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lancamentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "estoque_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_transacoes_estorno_de_fkey"
            columns: ["estorno_de"]
            isOneToOne: false
            referencedRelation: "estoque_extrato"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "estoque_transacoes_estorno_de_fkey"
            columns: ["estorno_de"]
            isOneToOne: false
            referencedRelation: "estoque_transacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_transacoes_retirado_por_fk"
            columns: ["retirado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_transacoes_unidade_fk"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_saldos: {
        Row: {
          praca_id: string | null
          produto_id: string | null
          quantidade: number | null
          ultimo_movimento: string | null
          unidade_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_lancamentos_praca_id_fkey"
            columns: ["praca_id"]
            isOneToOne: false
            referencedRelation: "estoque_pracas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lancamentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "estoque_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lancamentos_unidade_fk"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_see_sector: {
        Args: { p_sector: string; p_user_id: string }
        Returns: boolean
      }
      can_see_unidade: { Args: { u: string }; Returns: boolean }
      current_unidade: { Args: never; Returns: string }
      default_unidade: { Args: never; Returns: string }
      effective_unidade: { Args: never; Returns: string }
      estoque_estornar: {
        Args: { p_motivo: string; p_transacao_id: string }
        Returns: string
      }
      estoque_pode_operar: { Args: { p_unidade_id: string }; Returns: boolean }
      estoque_pode_ver: { Args: { p_unidade_id: string }; Returns: boolean }
      estoque_registrar_entrada: {
        Args: {
          p_documento?: string
          p_fornecedor?: string
          p_itens: Json
          p_observacao?: string
          p_ocorrido_em?: string
          p_unidade_id: string
        }
        Returns: string
      }
      estoque_registrar_saida: {
        Args: {
          p_itens: Json
          p_observacao?: string
          p_ocorrido_em?: string
          p_praca_id: string
          p_retirado_por: string
          p_unidade_id: string
        }
        Returns: string
      }
      estoque_unidade_atual: { Args: never; Returns: string }
      gerar_tarefas_recorrentes: { Args: never; Returns: number }
      notify_auditoria_prazo: { Args: never; Returns: undefined }
      notify_briefing_atrasado: { Args: never; Returns: undefined }
      notify_briefing_lembrete: { Args: never; Returns: undefined }
      notify_inatividade: { Args: never; Returns: undefined }
      notify_pendencias_casa: { Args: never; Returns: undefined }
      notify_resumo_matinal: { Args: never; Returns: undefined }
      notify_roteiro2_lembrete: { Args: never; Returns: undefined }
      notify_roteiro2_owner: { Args: never; Returns: undefined }
      notify_roteiro2_urgente: { Args: never; Returns: undefined }
      notify_ruptura_critica: { Args: never; Returns: undefined }
      notify_tarefa_prazo: { Args: never; Returns: undefined }
      pode_decidir_colaboradores: { Args: never; Returns: boolean }
      pode_editar_colaboradores: { Args: never; Returns: boolean }
      pode_validar_briefing: { Args: never; Returns: boolean }
      pode_ver_colaboradores: { Args: never; Returns: boolean }
      ve_todas_unidades: { Args: never; Returns: boolean }
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
