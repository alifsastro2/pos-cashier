import { verifySession } from '@/lib/dal'
import { orderEvents } from '@/lib/order-events'
import type { NewOrderPayload, StockAlertPayload } from '@/lib/order-events'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await verifySession()
  const tenantId = session.tenantId

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()

      function send(obj: object) {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)) }
        catch { /* stream already closed */ }
      }

      // Initial ping so the browser knows connection is alive
      controller.enqueue(enc.encode(': ping\n\n'))

      function onNewOrder(data: NewOrderPayload) {
        if (data.tenantId !== tenantId) return
        send({ type: 'new-order', cashierName: data.cashierName, orderType: data.orderType, orderNumber: data.orderNumber })
      }

      function onStockAlert(data: StockAlertPayload) {
        if (data.tenantId !== tenantId) return
        send({ type: 'stock-alert', low: data.low, out: data.out })
      }

      orderEvents.on('new-order', onNewOrder)
      orderEvents.on('stock-alert', onStockAlert)

      req.signal.addEventListener('abort', () => {
        orderEvents.off('new-order', onNewOrder)
        orderEvents.off('stock-alert', onStockAlert)
        try { controller.close() } catch { /* ignore */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
