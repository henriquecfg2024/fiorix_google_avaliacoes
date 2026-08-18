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
  MessageCircle,
  Settings,
  Upload,
  Settings2,
} from "lucide-react";

export const navigationGroups = {
  operacional: {
    label: "OPERACIONAL",
    icon: Briefcase,
    items: [
      {
        label: "Módulo BI",
        href: "/bi",
        icon: BarChart3,
        badge: "15.5k",
        badgeKey: "biCount",
        description: "15.591 títulos, 30,7% atraso",
      },
      {
        label: "Metas",
        href: "/bi/metas",
        icon: Target,
        badge: "281",
        badgeKey: "metasCount",
        badgeVariant: "destructive",
        description: "733 protocolos, gargalo 27,1d",
      },
      {
        label: "Produtividade - Caixa",
        href: "/bi/produtividade",
        icon: Users,
        badge: "7.058",
        badgeKey: "prodCount",
        description: "5.192 Digital, 1.866 Presencial",
      },
      {
        label: "Auditoria",
        href: "/bi/auditoria",
        icon: ShieldAlert,
        badge: "280",
        badgeKey: "auditoriaCount",
        badgeVariant: "amber",
        isNew: true,
        description: "280 SEM BALCÃO REG ID 76",
      },
    ],
  },
  gestao: {
    label: "GESTÃO",
    icon: PieChart,
    items: [
      { label: "Avaliações", href: "/avaliacoes", icon: Star },
      { label: "Estatísticas", href: "/estatisticas", icon: TrendingUp },
      { label: "Relatórios", href: "/relatorios", icon: FileText },
      {
        label: "Respostas Google",
        href: "/respostas-google",
        icon: MessageCircle,
        badge: "G",
      },
    ],
  },
  sistema: {
    label: "SISTEMA",
    icon: Settings,
    items: [
      {
        label: "Importações",
        href: "/bi/importacoes",
        icon: Upload,
        badge: "118.523",
        badgeKey: "importCount",
        description: "4 falhas ontem",
      },
      { label: "Configurações", href: "/configuracoes", icon: Settings2 },
    ],
  },
};
