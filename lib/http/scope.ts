let scope: string | null = null;
export const clientScope = () => scope;
export const setClientScope = (value: string | null) => { scope = value; };
