import type { ITicketCategory } from '@/interfaces/ITicketCategory.js';

export const DEFAULT_TICKET_CATEGORIES: ITicketCategory[] = [
  {
    id: 'suporte',
    name: 'Suporte',
    emoji: '🛠️',
    description: 'Precisa de ajuda? Abra um ticket de suporte!',
    color: '#ff6600',
  },
  {
    id: 'compras',
    name: 'Compras',
    emoji: '🛒',
    description: 'Compras, vendas e pagamentos',
    color: '#00ff00',
  },
  {
    id: 'ajuda',
    name: 'Ajuda',
    emoji: '❓',
    description: 'Precisa de ajuda ou suporte',
    color: '#0099ff',
  },
  {
    id: 'reclamacao',
    name: 'Reclamação',
    emoji: '😠',
    description: 'Reclamações e problemas',
    color: '#ff0000',
  },
  {
    id: 'sugestao',
    name: 'Sugestão',
    emoji: '💡',
    description: 'Sugestões e ideias',
    color: '#ffff00',
  },
];
