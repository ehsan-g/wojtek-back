export default () => ({
  redisUrl: process.env.REDIS_URL,
  jwtPrivatePem: process.env.JWT_PRIVATE_PEM,
  jwtPrivateKeyB64: process.env.JWT_PRIVATE_KEY_B64,
  jwtPublicPem: process.env.JWT_PUBLIC_PEM,
  jwtPublicKeyB64: process.env.JWT_PUBLIC_KEY_B64,
});
