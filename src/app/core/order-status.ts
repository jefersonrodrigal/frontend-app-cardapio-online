export interface OrderStatusStep {
  status: string;
  label: string;
  description: string;
}

export const ORDER_STATUS_STEPS: OrderStatusStep[] = [
  {
    status: 'Pendente',
    label: 'Recebido',
    description: 'Pedido recebido pelo restaurante.',
  },
  {
    status: 'EmPreparo',
    label: 'Em preparo',
    description: 'A cozinha esta preparando seus itens.',
  },
  {
    status: 'EmEntrega',
    label: 'Saiu para entrega',
    description: 'Pedido a caminho do endereco informado.',
  },
  {
    status: 'Entregue',
    label: 'Entregue',
    description: 'Pedido concluido.',
  },
];

const STATUS_LABELS: Record<string, string> = {
  Pendente: 'Recebido',
  EmPreparo: 'Em preparo',
  EmEntrega: 'Saiu para entrega',
  Entregue: 'Entregue',
  Cancelado: 'Cancelado',
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function orderStatusIndex(status: string): number {
  if (status === 'Cancelado') {
    return 0;
  }

  return Math.max(
    0,
    ORDER_STATUS_STEPS.findIndex((step) => step.status === status),
  );
}

export function isFinalOrderStatus(status: string): boolean {
  return status === 'Entregue' || status === 'Cancelado';
}
