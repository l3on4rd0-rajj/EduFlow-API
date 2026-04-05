export function createMockReq(overrides = {}) {
  return {
    body: {},
    headers: {},
    params: {},
    query: {},
    path: '/',
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  }
}

export function createMockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    send(payload) {
      this.body = payload
      return this
    },
  }
}

export function createNextSpy() {
  const calls = []
  const next = (...args) => {
    calls.push(args)
  }

  next.calls = calls
  next.called = () => calls.length > 0

  return next
}

export function getRouteHandler(router, method, routePath, handlerIndex = 0) {
  const layer = router.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === routePath &&
      entry.route.methods[method.toLowerCase()]
  )

  if (!layer) {
    throw new Error(`Rota ${method.toUpperCase()} ${routePath} nao encontrada`)
  }

  return layer.route.stack[handlerIndex].handle
}
