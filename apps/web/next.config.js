/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  transpilePackages: ["@lessonbuild/db", "@lessonbuild/shared"],
};
