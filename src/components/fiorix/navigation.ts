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
  Crown,
  Building2,
  MapPin,
  MessageSquare,
  MessageCircle,
  Printer,
  FileCheck2,
  RotateCcw,
} from "lucide-react";

export const navigationGroups = {
  gestao: {
    label: "PRESENÇA NO GOOGLE",
    icon: PieChart,
    items: [
      { label: "Avaliações", href: "/avaliacoes", icon: Star },
      { label: "Estatísticas", href: "/estatisticas", icon: TrendingUp },
      { label: "Relatórios", href: "/relatorios", icon: FileText },
    ],
  },
  operacional: {
    label: "GESTÃO DE PRAZOS",
    icon: Briefcase,
    items: [
      {
        label: "Impressões",
        href: "/controle-impressoes",
        icon: Printer,
        description: "Certidões e atos nos livros",
      },
      {
        label: "Prazos",
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
        label: "Recepção",
        href: "/bi/produtividade",
        icon: Users,
        description: "5.192 Digital, 1.866 Presencial",
      },
      {
        label: "RETORNOS",
        href: "/bi/retornos",
        icon: RotateCcw,
        description: "Consulte os retornos, responsáveis e observações de cada título.",
      },
      {
        label: "Auditoria",
        href: "/bi/auditoria",
        icon: ShieldAlert,
        description: "280 SEM BALCÃO REG ID 76",
      },
    ],
  },
  rhGestao: {
    label: "GESTÃO DE PESSOAS",
    icon: UserCheck,
    href: "/sistema/pessoas",
    items: [],
  },
  governancaIts: {
    label: "INSTRUÇÕES DE TRABALHO",
    icon: BookOpen,
    items: [
      {
        label: "Gestão de ITs",
        href: "/administracao/its",
        icon: BookOpen,
        description: "Acompanhe, revise e aprove Instruções de Trabalho",
      },
    ],
  },
  // GRUPO TRABALHO: Operações do dia a dia do colaborador (Missão 4.3.6)
  trabalho: {
    label: "ROTINA DE TRABALHO",
    icon: Briefcase,
    items: [
      {
        label: "Mensagens",
        href: "/mensagens",
        icon: MessageSquare,
        description: "Comunicação corporativa em tempo real",
      },
      {
        label: "Comunicados",
        href: "/pessoas/comunicados",
        icon: FileText,
        description: "Mural interno e minhas ciências",
      },
      {
        label: "Gestão de Comunicados",
        href: "/sistema/pessoas?tab=comunicados",
        icon: FileCheck2,
        description: "Criar comunicados e gerenciar ciências",
      },
      {
        label: "Minha IT",
        href: "/minha-it",
        icon: BookOpen,
        description: "Instrução oficial • Responsável Técnico",
      },
      {
        label: "Rastreio do Título",
        href: "/trajetoria-titulo",
        icon: MapPin,
        description: "Última localização e situação do protocolo",
      },
    ],
  },
  // PESSOAL: apenas itens pessoais (Férias e Holerites)
  pessoas: {
    label: "MEU ESPAÇO",
    icon: Target,
    items: [
      {
        label: "Férias",
        href: "/pessoas/ferias",
        icon: Briefcase,
        description: "Meu saldo e solicitações individuais",
      },
      {
        label: "Holerites",
        href: "/pessoas/holerites",
        icon: FileText,
        description: "Meus contracheques e comprovantes",
      },
    ],
  },
  sistema: {
    label: "SISTEMA & TECNOLOGIA",
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
      {
        label: "Gestão de Mensagens",
        href: "/administracao/mensagens",
        icon: MessageCircle,
        description: "Políticas, métricas e governança",
      },
    ],
  },
  master: {
    label: "MASTER SAAS",
    icon: Crown,
    items: [
      {
        label: "Cartórios (Tenants)",
        href: "/master/tenants",
        icon: Building2,
        description: "Gestão multi-tenant da plataforma",
      },
      {
        label: "Mensagens SaaS",
        href: "/master/mensagens",
        icon: MessageSquare,
        description: "Telemetria e volume global de mensageria",
      },
    ],
  },
};
