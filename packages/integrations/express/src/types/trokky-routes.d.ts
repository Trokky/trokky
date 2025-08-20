declare module '@trokky/routes' {
  export interface RoutesConfig {
    [key: string]: any;
  }
  export interface HttpRequest {
    [key: string]: any;
  }
  export interface HttpResponse {
    [key: string]: any;
  }
  export type RouteHandler = (request: HttpRequest) => Promise<HttpResponse>;
  export class TrokkyRoutes {
    constructor(config?: RoutesConfig);
    [key: string]: any;
  }
}