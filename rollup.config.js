import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import copy from 'rollup-plugin-copy'
import { string } from 'rollup-plugin-string';

export default {
  input: 'src/worker.js',
  output: {
    exports: 'named',
    format: 'es',
    file: 'terraform/dist/worker.js',
    sourcemap: true,
  },

  // slug.txt will be uploaded as a text module, not as part of the rollup bundle.
  // so we must declare it as an external dependency (to be resolved at runtime).
//   external: ['./slug.txt'],
  plugins: [
    commonjs(),
    nodeResolve({ browser: true }),
    string({
      include: "public/**/*.html",
    }),
    copy({
      targets: [{ src: './src/slug.txt', dest: './dist/' }],
    }),
  ],
}
