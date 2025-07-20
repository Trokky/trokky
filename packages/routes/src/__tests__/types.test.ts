import type {
  HttpMethod,
  HttpRequest,
  HttpResponse,
  RouteHandler,
  RouteDefinition,
  RoutesConfig,
  CorsOptions,
  ApiResponse,
  FrameworkAdapter
} from '../types.js'

// Type tests - these will fail at compile time if types are incorrect
describe('Type Definitions', () => {
  it('should define HttpMethod correctly', () => {
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    expect(methods).toHaveLength(6)
  })

  it('should define HttpRequest interface correctly', () => {
    const request: HttpRequest = {
      method: 'GET',
      url: '/api/v1/collections/posts',
      path: '/api/v1/collections/posts',
      query: { limit: '10' },
      params: { collection: 'posts' },
      headers: { 'Content-Type': 'application/json' },
      body: { data: 'test' },
      files: []
    }
    
    expect(request.method).toBe('GET')
    expect(request.url).toBe('/api/v1/collections/posts')
  })

  it('should define HttpResponse interface correctly', () => {
    const response: HttpResponse = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { success: true }
    }
    
    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toBe('application/json')
  })

  it('should define RouteHandler type correctly', () => {
    const handler: RouteHandler = async (request: HttpRequest): Promise<HttpResponse> => {
      return {
        status: 200,
        headers: {},
        body: { success: true }
      }
    }
    
    expect(typeof handler).toBe('function')
  })

  it('should define RouteDefinition interface correctly', () => {
    const handler: RouteHandler = async () => ({ status: 200, headers: {}, body: null })
    
    const route: RouteDefinition = {
      method: 'GET',
      path: '/test',
      handler,
      description: 'Test route'
    }
    
    expect(route.method).toBe('GET')
    expect(route.path).toBe('/test')
    expect(typeof route.handler).toBe('function')
  })

  it('should define CorsOptions interface correctly', () => {
    const corsOptions: CorsOptions = {
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      credentials: true,
      maxAge: 3600
    }
    
    expect(corsOptions.origin).toEqual(['http://localhost:3000'])
    expect(corsOptions.methods).toEqual(['GET', 'POST'])
  })

  it('should define ApiResponse interface correctly', () => {
    const successResponse: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: '123' }
    }
    
    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found'
      }
    }
    
    expect(successResponse.success).toBe(true)
    expect(successResponse.data?.id).toBe('123')
    expect(errorResponse.success).toBe(false)
    expect(errorResponse.error?.code).toBe('NOT_FOUND')
  })

  it('should define FrameworkAdapter interface correctly', () => {
    const adapter: FrameworkAdapter<any, any> = {
      name: 'test-adapter',
      convertRequest: (req: any): HttpRequest => ({
        method: 'GET',
        url: req.url,
        path: req.path,
        query: {},
        params: {},
        headers: {}
      }),
      convertResponse: (res: HttpResponse): any => res,
      handleRoute: (handler: RouteHandler) => async (req: any) => {
        const httpReq = adapter.convertRequest(req)
        const httpRes = await handler(httpReq)
        return adapter.convertResponse(httpRes)
      }
    }
    
    expect(adapter.name).toBe('test-adapter')
    expect(typeof adapter.convertRequest).toBe('function')
    expect(typeof adapter.convertResponse).toBe('function')
    expect(typeof adapter.handleRoute).toBe('function')
  })

  // Test optional properties
  it('should allow optional properties in interfaces', () => {
    const minimalRequest: HttpRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {},
      params: {},
      headers: {}
      // body and files are optional
    }
    
    const minimalRoute: RouteDefinition = {
      method: 'GET',
      path: '/test',
      handler: async () => ({ status: 200, headers: {}, body: null })
      // description is optional
    }
    
    expect(minimalRequest.body).toBeUndefined()
    expect(minimalRequest.files).toBeUndefined()
    expect(minimalRoute.description).toBeUndefined()
  })

  // Test union types
  it('should support union types for query and header values', () => {
    const request: HttpRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {
        single: 'value',
        multiple: ['value1', 'value2'],
        empty: undefined
      },
      params: {},
      headers: {
        'content-type': 'application/json',
        'x-custom': ['value1', 'value2']
      }
    }
    
    expect(typeof request.query.single).toBe('string')
    expect(Array.isArray(request.query.multiple)).toBe(true)
    expect(request.query.empty).toBeUndefined()
  })

  // Test generic types
  it('should support generic ApiResponse types', () => {
    type UserData = { id: string; name: string }
    
    const userResponse: ApiResponse<UserData> = {
      success: true,
      data: {
        id: '123',
        name: 'John Doe'
      }
    }
    
    const listResponse: ApiResponse<UserData[]> = {
      success: true,
      data: [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' }
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 10
      }
    }
    
    expect(userResponse.data?.id).toBe('123')
    expect(listResponse.data).toHaveLength(2)
    expect(listResponse.meta?.total).toBe(2)
  })
})