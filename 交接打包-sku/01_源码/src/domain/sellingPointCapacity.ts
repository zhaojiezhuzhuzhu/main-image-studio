const SAFE_WIDTH=1300,GAPS=60,MIN_PADDING_TOTAL=144;
export function sellingPointCapacityIssue(textWidths:number[]):string|null{
 return textWidths.reduce((sum,width)=>sum+width,0)+GAPS+MIN_PADDING_TOTAL>SAFE_WIDTH?'三个卖点总宽度超出安全区，请缩短文案':null;
}
