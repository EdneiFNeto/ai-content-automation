import express, { Request, Response } from 'express';
import path from 'path';
import userRoutes from './routes/user.routes';
import assetRoutes from './routes/asset.routes';
import postsRoutes from './routes/posts.routes';
import imagesRoutes from './routes/images.routes';
import { errorHandler } from './middlewares/error-handler.middleware';

const app = express();

// Respeita X-Forwarded-Proto/Host de proxies (ngrok, load balancer) — sem isso,
// req.protocol sempre reporta "http" mesmo atrás de um túnel HTTPS, o que gera
// imageUrl errada para a Instagram Graph API (que exige HTTPS)
app.set('trust proxy', true);

app.use(express.json());

// Servir arquivos estáticos da pasta assets diretamente
// Isso resolve o erro "Cannot GET" se o arquivo existir na pasta
app.use('/assets', express.static(path.resolve(__dirname, '../assets')));

// Registro das rotas
app.use('/users', userRoutes);
app.use('/assets', assetRoutes);
app.use('/posts', postsRoutes);
app.use('/images', imagesRoutes);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Servidor TypeScript configurado com sucesso!' });
});

// Precisa ser o último middleware registrado
app.use(errorHandler);

export default app;
