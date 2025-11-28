export default () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  facturacion: {
    apiUrl: process.env.FACTURACION_API_URL || 'http://localhost:3000/api/v1',
    apiToken: process.env.FACTURACION_API_TOKEN,
    companyId: process.env.FACTURACION_COMPANY_ID,
  },
  printer: {
    type: (process.env.PRINTER_TYPE as 'epson' | 'star') || 'epson',
    interface: process.env.PRINTER_INTERFACE || 'tcp://192.168.1.100:9100',
    characterSet: process.env.PRINTER_CHARACTER_SET || 'PC437_USA',
    removeSpecialCharacters: process.env.PRINTER_REMOVE_SPECIAL_CHARS === 'true',
    lineCharacter: process.env.PRINTER_LINE_CHARACTER || '-',
    width: parseInt(process.env.PRINTER_WIDTH, 10) || 48,
  },
  recargos: {
    llevar: parseFloat(process.env.RECARGO_LLEVAR) || 0.10,
    delivery: parseFloat(process.env.RECARGO_DELIVERY) || 0.20,
    deliveryFee: parseFloat(process.env.DELIVERY_FEE) || 2.00,
  },
  workers: {
    invoiceQueueCron: process.env.INVOICE_QUEUE_CRON || '0 23 * * *',
    printQueueInterval: parseInt(process.env.PRINT_QUEUE_INTERVAL, 10) || 2000,
  },
});
