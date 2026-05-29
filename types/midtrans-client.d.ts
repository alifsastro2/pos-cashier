declare module 'midtrans-client' {
  interface CoreApiOptions {
    isProduction: boolean
    serverKey: string
    clientKey: string
  }

  interface TransactionDetails {
    order_id: string
    gross_amount: number
  }

  interface CustomerDetails {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
  }

  interface ChargeResponse {
    transaction_id: string
    order_id: string
    transaction_status: string
    fraud_status?: string
    payment_type: string
    gross_amount: string
    currency: string
    expiry_time?: string
    qr_string?: string
    actions?: { name: string; url: string; method?: string }[]
    va_numbers?: { bank: string; va_number: string }[]
    permata_va_number?: string
    [key: string]: unknown
  }

  class CoreApi {
    constructor(options: CoreApiOptions)
    charge(payload: Record<string, unknown>): Promise<ChargeResponse>
    transaction: {
      status(orderId: string): Promise<ChargeResponse>
      cancel(orderId: string): Promise<ChargeResponse>
    }
  }

  export { CoreApi }
}
