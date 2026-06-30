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
  EmAtraso: 'Em atraso',
  Entregue: 'Entregue',
  Cancelado: 'Cancelado',
};

const DELAYED_ORDER_STATUS_STEP: OrderStatusStep = {
  status: 'EmAtraso',
  label: 'Em atraso',
  description: 'Pedido passou do prazo previsto.',
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function orderStatusSteps(status: string): OrderStatusStep[] {
  if (status !== 'EmAtraso') {
    return ORDER_STATUS_STEPS;
  }

  const deliveredStep = ORDER_STATUS_STEPS[ORDER_STATUS_STEPS.length - 1];
  return [
    ...ORDER_STATUS_STEPS.slice(0, -1),
    DELAYED_ORDER_STATUS_STEP,
    deliveredStep,
  ];
}

export function orderStatusIndex(status: string, steps = orderStatusSteps(status)): number {
  if (status === 'Cancelado') {
    return 0;
  }

  return Math.max(
    0,
    steps.findIndex((step) => step.status === status),
  );
}

export function isFinalOrderStatus(status: string): boolean {
  return status === 'Entregue' || status === 'Cancelado';
}
