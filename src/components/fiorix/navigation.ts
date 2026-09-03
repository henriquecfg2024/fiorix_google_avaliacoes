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
  pessoas: {
    label: "PESSOAS & RH",
    icon: Users,
    items: [
      {
        label: "Minha Central",
        href: "/pessoas",
        icon: Target,
      },
      {
        label: "Comunicados",
        href: "/pessoas/comunicados",
        icon: FileText,
      },
      {
        label: "Férias",
        href: "/pessoas/ferias",
        icon: Briefcase,
      },
      {
        label: "Holerites",
        href: "/pessoas/holerites",
        icon: FileText,
      },
      {
        label: "Painel RH",
        href: "/sistema/pessoas",
        icon: UserCheck,
        description: "Gestão do quadro de colaboradores",
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
