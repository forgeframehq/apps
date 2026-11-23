import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { C } from './kit';

const LEFT = 46;
const BOTTOM = 22;
const TOP = 8;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 4, 6, 8, 10]) if (v <= m * mag) return m * mag;
  return 10 * mag;
}

/** Minimal bar / line chart with a few y gridlines and sparse x labels. */
export function Chart({ values, labels, bars = true, yFormat = (v) => String(Math.round(v)), height = 190 }: {
  values: number[]; labels: string[]; bars?: boolean; yFormat?: (v: number) => string; height?: number;
}) {
  const [width, setWidth] = useState(0);
  const w = width - LEFT;
  const h = height - BOTTOM - TOP;
  const yMax = niceMax(Math.max(0, ...values));
  const step = values.length ? w / values.length : 0;
  const x = (i: number) => LEFT + step * (i + 0.5);
  const y = (v: number) => TOP + h - (h * v) / yMax;
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[0, 1, 2, 3, 4].map((i) => {
            const gy = TOP + h - (h * i) / 4;
            return (
              <React.Fragment key={i}>
                <Line x1={LEFT} y1={gy} x2={width} y2={gy} stroke={i ? C.border : C.cardHi} strokeWidth={1} />
                <SvgText x={LEFT - 8} y={gy + 4} fill={C.muted} fontSize={11} textAnchor="end">{yFormat((yMax * i) / 4)}</SvgText>
              </React.Fragment>
            );
          })}
          {bars && values.map((v, i) => {
            const bw = Math.min(step * 0.62, 28);
            return v > 0 ? <Rect key={i} x={x(i) - bw / 2} y={y(v)} width={bw} height={TOP + h - y(v)} fill={C.accent} /> : null;
          })}
          {!bars && values.length > 1 && <Polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={C.accent} strokeWidth={2.5} />}
          {!bars && values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={C.accent} />)}
          {labels.map((l, i) => (l ? <SvgText key={i} x={x(i)} y={height - 4} fill={C.muted} fontSize={11} textAnchor="middle">{l}</SvgText> : null))}
        </Svg>
      )}
    </View>
  );
}
