import { z } from 'zod';

/**
 * Environment is parsed once, at startup, and the process refuses to run on bad
 * input. Discovering that a signing key is missing on the first request that
 * needs one is far worse than never starting.
 */
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGO_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
});

export interface Config {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  mongoUrl?: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  /**
   * bcrypt work factor. Deliberately low under test: the suite hashes a few
   * hundred passwords and none of them protect anything.
   */
  bcryptRounds: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }

  const values = parsed.data;

  return {
    port: values.PORT,
    nodeEnv: values.NODE_ENV,
    mongoUrl: values.MONGO_URL,
    jwtSecret: values.JWT_SECRET,
    jwtExpiresIn: values.JWT_EXPIRES_IN,
    corsOrigins: values.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    bcryptRounds: values.NODE_ENV === 'test' ? 4 : 10,
  };
}
