export function standaloneHref(href, base) {
 if(href==="/")return base;
 if(/^\/licenses\/[A-Za-z0-9-]+\.txt$/.test(href))return new URL(href.slice(1),base).href;
 if(href.startsWith("/")&&!href.startsWith("//"))return "https://heng-li-yuan.com"+href;
 return href;
}
