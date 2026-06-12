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

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "~*" {
  const content: string;
  export default content;
}
