/**
 * 计算两点间距离
 */
export function calculateDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Catmull-Rom Spline 转为贝塞尔曲线控制点
 * 返回贝塞尔段数组，每段为 [cp1, cp2, p2]
 */
export function getCatmullRomBeziers(points) {
  const beziers = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    // 计算控制点
    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6
    };
    beziers.push([cp1, cp2, p2]);
  }
  return beziers;
}

export function calculateDistances(points) {
  const distances = [];
  for (let i = 0; i < points.length - 1; i++) {
    const distance = calculateDistance(points[i], points[i + 1]);
    distances.push(distance);
  }
  return distances;
}
