// Fix framer-motion Variants type (aceita "easeOut" como ease string)
import 'framer-motion';

declare module 'framer-motion' {
  interface Transition {
    ease?: string | number[];
  }
}

// Fix Radix UI asChild prop (incompatibilidade de versão entre @radix-ui packages)
// Os componentes Radix/shadcn usam asChild mas os types às vezes não refletem corretamente
declare module '@radix-ui/react-dropdown-menu' {
  interface DropdownMenuTriggerProps {
    asChild?: boolean;
  }
}

declare module '@radix-ui/react-dialog' {
  interface DialogTriggerProps {
    asChild?: boolean;
  }
}

declare module '@radix-ui/react-tooltip' {
  interface TooltipTriggerProps {
    asChild?: boolean;
  }
}

// Fix next-themes ThemeProviderProps (importação movida nas versões mais novas)
declare module 'next-themes' {
  export interface ThemeProviderProps {
    children: React.ReactNode;
    [key: string]: any;
  }
}
