import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { printingApi, type PrintComandaDto, type PrintTicketDto } from '../api/printing';
import { toast } from 'sonner';

export function usePrintComanda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PrintComandaDto) => printingApi.printComanda(data),
    onSuccess: () => {
      toast.success('Comanda enviada a impresora', {
        description: 'La comanda se está imprimiendo',
      });
    },
    onError: (error: any) => {
      toast.error('Error al imprimir comanda', {
        description: error.response?.data?.message || 'Intenta nuevamente',
      });
    },
  });
}

export function usePrintTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PrintTicketDto) => printingApi.printTicket(data),
    onSuccess: () => {
      toast.success('Ticket enviado a impresora', {
        description: 'El ticket se está imprimiendo',
      });
    },
    onError: (error: any) => {
      toast.error('Error al imprimir ticket', {
        description: error.response?.data?.message || 'Intenta nuevamente',
      });
    },
  });
}

export function usePrintJobs(orderId: string) {
  return useQuery({
    queryKey: ['printJobs', orderId],
    queryFn: () => printingApi.getJobsByOrder(orderId),
    enabled: !!orderId,
  });
}

export function useReprintJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => printingApi.reprintJob(jobId),
    onSuccess: () => {
      toast.success('Reimpresión enviada', {
        description: 'El documento se está reimprimiendo',
      });
    },
    onError: (error: any) => {
      toast.error('Error al reimprimir', {
        description: error.response?.data?.message || 'Intenta nuevamente',
      });
    },
  });
}
