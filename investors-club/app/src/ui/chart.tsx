import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { moneyShort } from '@/lib/format';

import { C } from './kit';

const LEFT = 48;
const BOTTOM = 22;
const TOP = 10;
const RIGHT = 8;

/** Line graph of prices or portfolio value. The y axis hugs the data so small moves are visible. */
export function PriceChart({ values, labels, color, height = 200 }: { values: number[]; labels: string[]; color?: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const stroke = color ?? (values.length > 1 && values[values.length - 1] < values[0] ? C.bad : C.good);
  const w = width - LEFT - RIGHT;
  const h = height - BOTTOM - TOP;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || Math.abs(hi) * 0.02 || 1) * 0.12;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const x = (i: number) => LEFT + (values.length > 1 ? (w * i) / (values.length - 1) : w / 2);
  const y = (v: number) => TOP + h - (h * (v - yMin)) / (yMax - yMin);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  // At most five x labels, evenly spread, always including the first and last.
  const ticks = values.length <= 5 ? values.map((_, i) => i) : [0, 1, 2, 3, 4].map((k) => Math.round((last * k) / 4));
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && values.length > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 1, 2, 3].map((i) => {
            const v = yMin + ((yMax - yMin) * i) / 3;
            return (
              <React.Fragment key={i}>
                <Line x1={LEFT} y1={y(v)} x2={width - RIGHT} y2={y(v)} stroke={C.border} strokeWidth={1} />
                <SvgText x={LEFT - 8} y={y(v) + 4} fill={C.muted} fontSize={11} fontFamily="sans-serif" textAnchor="end">{moneyShort(v)}</SvgText>
              </React.Fragment>
            );
          })}
          {values.length > 1 && <Path d={`${line} L${x(last).toFixed(1)},${TOP + h} L${x(0).toFixed(1)},${TOP + h} Z`} fill="url(#fill)" />}
          {values.length > 1 && <Path d={line} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
          <Circle cx={x(last)} cy={y(values[last])} r={4} fill={stroke} />
          {ticks.map((i, k) => (labels[i] ? (
            <SvgText key={i} x={x(i)} y={height - 4} fill={C.muted} fontSize={11} fontFamily="sans-serif" textAnchor={k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}>{labels[i]}</SvgText>
          ) : null))}
        </Svg>
      )}
    </View>
  );
}
