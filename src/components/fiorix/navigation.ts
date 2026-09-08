import {
  Briefcase,
  BarChart3,
  Target,
  Users,
  ShieldAlert,
  PieChart,
  Star,
  TrendingUp,
  FileText,
  Settings,
  Upload,
  Settings2,
  Activity,
  UserCheck,
  BookOpen,
  ShieldCheck,
} from "lucide-react";

export const navigationGroups = {
  operacional: {
    label: "OPERACIONAL & BI",
    icon: Briefcase,
    items: [
      {
        label: "Módulo BI",
        href: "/bi",
        icon: BarChart3,
        description: "15.591 títulos, 30,7% atraso",
      },
      {
        label: "Metas",
        href: "/bi/metas",
        icon: Target,
        description: "733 protocolos, gargalo 27,1d",
      },
      {
        label: "Tarefas",
        href: "/bi/tarefas",
        icon: FileText,
        description: "Previsão de Carga Operacional",
      },
      {
        label: "Produtividade - Caixa",
        href: "/bi/produtividade",
        icon: Users,
        description: "5.192 Digital, 1.866 Presencial",
      },
      {
        label: "Auditoria",
        href: "/bi/auditoria",
        icon: ShieldAlert,
        description: "280 SEM BALCÃO REG ID 76",
      },
    ],
  },
  gestao: {
    label: "GESTÃO & ANÁLISES",
    icon: PieChart,
    items: [
      { label: "Avaliações", href: "/avaliacoes", icon: Star },
      { label: "Estatísticas", href: "/estatisticas", icon: TrendingUp },
      { label: "Relatórios", href: "/relatorios", icon: FileText },
    ],
  },
  rhGestao: {
    label: "GESTÃO DE RH & ITs",
    icon: UserCheck,
    items: [
      {
        label: "Lançamento de Férias",
        href: "/sistema/pessoas?tab=ferias",
        icon: Briefcase,
        description: "Lançamentos, Escalas & CLT 135",
      },
      {
        label: "Lançamento de Holerites",
        href: "/sistema/pessoas?tab=holerites",
        icon: Upload,
        description: "Upload e distribuição em lote",
      },
      {
        label: "Gestão de Comunicados",
        href: "/sistema/pessoas?tab=comunicados",
        icon: FileText,
        description: "Criar comunicados e gerenciar ciências",
      },
      {
        label: "Fiscalização de ITs",
        href: "/gestao/rh/instrucoes-trabalho-monitoramento",
        icon: ShieldCheck,
        description: "Auditoria WORM & Ciências das equipes",
      },
      {
        label: "Catálogo de ITs",
        href: "/administracao/its",
        icon: BookOpen,
        description: "Acervo de Instruções de Trabalho",
      },
      {
        label: "Painel Geral de RH",
        href: "/sistema/pessoas",
        icon: Users,
        description: "Quadro de colaboradores e governança",
      },
    ],
  },
  pessoas: {
    label: "MEU ESPAÇO (PESSOAL)",
    icon: Target,
    items: [
      {
        label: "Minha Central",
        href: "/pessoas",
        icon: Target,
        description: "Meu painel com resumo e pendências",
      },
      {
        label: "Meus Comunicados",
        href: "/pessoas/comunicados",
        icon: FileText,
        description: "Mural interno e minhas ciências",
      },
      {
        label: "Minhas Férias",
        href: "/pessoas/ferias",
        icon: Briefcase,
        description: "Meu saldo e solicitações individuais",
      },
      {
        label: "Meus Holerites",
        href: "/pessoas/holerites",
        icon: FileText,
        description: "Meus contracheques e comprovantes",
      },
      {
        label: "Minha IT",
        href: "/minha-it",
        icon: BookOpen,
        description: "Meu procedimento oficial assinado",
      },
    ],
  },
  sistema: {
    label: "SISTEMA & INFRA",
    icon: Settings,
    items: [
      {
        label: "Central de Operações",
        href: "/sistema/operacoes",
        icon: Activity,
        description: "Saúde e monitoramento",
      },
      {
        label: "Importações",
        href: "/bi/importacoes",
        icon: Upload,
        description: "4 falhas ontem",
      },
      { label: "Configurações", href: "/configuracoes", icon: Settings2 },
    ],
  },
};
