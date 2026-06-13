declare module "zxcvbn" {
  interface ZxcvbnResult {
    score: number;
    feedback: {
      warning: string;
      suggestions: string[];
    };
  }
  function zxcvbn(password: string, userInputs?: string[]): ZxcvbnResult;
  export = zxcvbn;
}
