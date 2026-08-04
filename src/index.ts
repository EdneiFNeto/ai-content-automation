import 'dotenv/config';
import app from './app';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 [server]: Servidor rodando em http://localhost:${port}`);
});
