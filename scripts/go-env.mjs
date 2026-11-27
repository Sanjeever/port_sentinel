export function platformGoEnv() {
  const env = {...process.env};
  if (process.platform === 'darwin') {
    env.MACOSX_DEPLOYMENT_TARGET = '12.0';
    env.CGO_CFLAGS = `${env.CGO_CFLAGS ?? ''} -mmacosx-version-min=12.0`.trim();
    env.CGO_LDFLAGS = `${env.CGO_LDFLAGS ?? ''} -mmacosx-version-min=12.0`.trim();
    env.GOFLAGS = `${env.GOFLAGS ?? ''} -ldflags=-linkmode=external`.trim();
  } else if (process.platform === 'linux') {
    env.GOFLAGS = `${env.GOFLAGS ?? ''} -tags=webkit2_41`.trim();
  }
  return env;
}
