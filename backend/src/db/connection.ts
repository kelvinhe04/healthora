import mongoose from 'mongoose';

let connected = false;

export async function connectDB() {
  if (connected) return;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME?.trim();
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, dbName ? { dbName } : undefined);
  connected = true;
  // Host queda visible (sin credenciales) para que scripts manuales como set-owner dejen claro
  // contra que cluster se esta escribiendo - un .env local apuntando al cluster equivocado es
  // indistinguible del correcto si solo se loguea el dbName (ver issue admin/owner en prod).
  const host = uri.replace(/\/\/[^@]*@/, '//***@');
  console.log(`MongoDB connected${dbName ? ` (${dbName})` : ''} -> ${host}`);
}
