import swaggerUi from 'swagger-ui-express';
import type { OpenAPI } from 'openapi-types';
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerSpec = swaggerJSDoc({
  swaggerDefinition: {
    openapi: '3.0.3',
    info: { title: 'OpenClaw', version: '1.0.0', description: 'OpenClaw REST API' },
    servers: [{ url: '/api' }],
    tags: [{ name: 'auth' }, { name: 'agent' }, { name: 'conversation' }, { name: 'message' }],
  },
  apis: ['**/routes/**/doc.yaml'],
}) as OpenAPI.Document;

const swaggerConf = swaggerUi.setup(swaggerSpec);

export { swaggerConf, swaggerSpec };
