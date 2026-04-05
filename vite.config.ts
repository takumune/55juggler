import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // GitHub Pagesで公開するためのベースバス設定
    // local開発(npm run dev)の時は '/'、ビルド(npm run build)の時は '/55juggler/' にします
    base: command === 'build' ? '/55juggler/' : '/',
  };
});
