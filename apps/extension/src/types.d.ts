declare module "data-url:*" {
  const content: string;
  export default content;
}

declare module "data-url:~assets/*" {
  const content: string;
  export default content;
}

declare module "*logo.svg" {
  const content: string;
  export default content;
}
