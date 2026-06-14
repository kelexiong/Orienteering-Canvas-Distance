import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Segment, ProjectConfig, PDFConfig } from '../types'
import { formatDistance, getA4CanvasSize, segmentPixelLength } from './mapScale'

interface ReportGroup {
  groupId: string
  groupIndex: number
  actual: Segment | null
  compares: Segment[]
  segments: Segment[]
  image: string
}

export class PDFExporter {
  private config: PDFConfig
  private projectConfig: ProjectConfig

  constructor(config: PDFConfig, projectConfig: ProjectConfig) {
    this.config = config
    this.projectConfig = projectConfig
  }

  async exportPDF(segments: Segment[], canvasElement: HTMLCanvasElement): Promise<void> {
    const pdf = new jsPDF({
      orientation: this.config.orientation,
      unit: 'mm',
      format: this.config.pageSize
    })

    const report = this.createReportElement(segments, canvasElement)
    document.body.appendChild(report)

    try {
      await this.waitForImages(report)
      await this.addReportElements(pdf, report)
      pdf.save(this.getFileName())
    } finally {
      report.remove()
    }
  }

  private createReportElement(segments: Segment[], canvasElement: HTMLCanvasElement): HTMLElement {
    const groups = this.buildReportGroups(segments, canvasElement)
    const root = document.createElement('div')
    root.className = 'pdf-report'
    root.style.cssText = [
      'position: fixed',
      'left: -10000px',
      'top: 0',
      'width: 794px',
      'box-sizing: border-box',
      'padding: 30px',
      'background: #ffffff',
      'color: #1f2937',
      'font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'
    ].join(';')

    root.innerHTML = `
      <style>
        .pdf-report * { box-sizing: border-box; }
        .pdf-report h1 { margin: 0 0 10px; font-size: 27px; color: #111827; }
        .pdf-report .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; color: #4b5563; font-size: 13px; }
        .pdf-report .pill { padding: 4px 9px; border-radius: 999px; background: #eef5ff; color: #1d4ed8; }
        .pdf-report .group { margin: 0 0 16px; padding: 14px; border: 1px solid #d8e5f7; border-radius: 8px; background: #f8fbff; break-inside: avoid; page-break-inside: avoid; }
        .pdf-report .group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .pdf-report h2 { margin: 0; font-size: 18px; color: #0f172a; }
        .pdf-report .group-count { color: #64748b; font-size: 12px; }
        .pdf-report .map-frame { display: flex; align-items: center; justify-content: center; margin: 8px 0 12px; border: 1px solid #dbeafe; border-radius: 6px; background: #fff; overflow: hidden; }
        .pdf-report .map-img { display: block; max-width: 100%; max-height: 300px; width: auto; height: auto; object-fit: contain; }
        .pdf-report .empty-map { margin: 8px 0 12px; padding: 18px; text-align: center; color: #94a3b8; background: #fff; border: 1px dashed #cbd5e1; border-radius: 6px; }
        .pdf-report table { width: 100%; border-collapse: collapse; margin-top: 8px; background: #fff; font-size: 12px; }
        .pdf-report th, .pdf-report td { border: 1px solid #e5edf8; padding: 7px 8px; text-align: left; vertical-align: top; }
        .pdf-report th { color: #475569; background: #eef5ff; font-weight: 700; }
        .pdf-report .route-name { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
        .pdf-report .color-dot { display: inline-block; width: 9px; height: 9px; border-radius: 999px; vertical-align: middle; }
        .pdf-report .role { display: inline-block; padding: 2px 6px; border-radius: 5px; color: #fff; font-size: 11px; }
        .pdf-report .role.actual { background: #409eff; }
        .pdf-report .role.compare { background: #e6a23c; }
        .pdf-report .desc { margin-top: 5px; color: #4b5563; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
        .pdf-report h3 { margin: 12px 0 7px; font-size: 14px; color: #2563eb; }
        .pdf-report .marker-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
        .pdf-report .marker-row { padding: 7px 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; }
        .pdf-report .marker-title { display: flex; gap: 6px; align-items: center; margin-bottom: 3px; }
        .pdf-report .tag { display: inline-block; padding: 2px 6px; border-radius: 5px; background: #eef2ff; color: #3730a3; font-size: 11px; }
      </style>
      <div class="pdf-cover">
        <h1>${this.escapeHtml(this.getReportTitle())}</h1>
        <div class="meta">
          <span class="pill">作者：${this.escapeHtml(this.projectConfig.author || 'Orienteering App')}</span>
          <span class="pill">日期：${this.escapeHtml(this.formatDate(this.projectConfig.date))}</span>
          <span class="pill">比例尺：1:${this.escapeHtml(String(this.projectConfig.scale))}</span>
          <span class="pill">分组数：${groups.length}</span>
          <span class="pill">路线数：${segments.length}</span>
        </div>
      </div>
      ${groups.map(group => this.renderGroup(group)).join('')}
    `

    return root
  }

  private buildReportGroups(segments: Segment[], canvasElement: HTMLCanvasElement): ReportGroup[] {
    const groupIds = [...new Set(segments.map(segment => segment.groupId))]
    return groupIds.map((groupId, groupIndex) => {
      const inGroup = segments.filter(segment => segment.groupId === groupId)
      const actual = inGroup.find(segment => segment.trackRole === 'actual') || null
      const compares = inGroup.filter(segment => segment.trackRole === 'compare')
      return {
        groupId,
        groupIndex,
        actual,
        compares,
        segments: actual ? [actual, ...compares] : inGroup,
        image: inGroup.find(segment => segment.groupImage)?.groupImage || this.getFallbackImage(inGroup, canvasElement)
      }
    })
  }

  private renderGroup(group: ReportGroup): string {
    return `
      <section class="group">
        <div class="group-head">
          <h2>分组 ${group.groupIndex + 1}${group.actual?.name ? `：${this.escapeHtml(group.actual.name)}` : ''}</h2>
          <span class="group-count">${group.segments.length} 条路线</span>
        </div>
        ${this.config.includeMap ? this.renderMap(group.image) : ''}
        ${this.renderRouteTable(group)}
        ${this.config.includeDescriptions ? this.renderDescriptions(group.segments) : ''}
        ${this.config.includeMarkers ? this.renderMarkers(group.segments) : ''}
      </section>
    `
  }

  private renderRouteTable(group: ReportGroup): string {
    const actualLength = group.actual ? segmentPixelLength(group.actual.points) : 0
    const rows = group.segments
      .map(segment => {
        const length = segmentPixelLength(segment.points)
        const diff = segment.trackRole === 'compare' && actualLength > 0
          ? this.formatDiff(length, actualLength)
          : '基准'
        return `
          <tr>
            <td>
              <span class="route-name"><span class="color-dot" style="background:${this.escapeHtml(segment.color)}"></span>${this.escapeHtml(segment.name || '未命名路线')}</span>
            </td>
            <td><span class="role ${segment.trackRole === 'compare' ? 'compare' : 'actual'}">${segment.trackRole === 'compare' ? '对比路线' : '实际跑动'}</span></td>
            <td>${this.formatLength(length)}</td>
            <td>${segment.points.length}</td>
            <td>${diff}</td>
          </tr>
        `
      })
      .join('')

    return `
      <table>
        <thead>
          <tr><th>路线</th><th>类型</th><th>距离</th><th>控制点</th><th>相对实际</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  }

  private renderDescriptions(segments: Segment[]): string {
    const rows = segments
      .filter(segment => !!segment.description)
      .map(
        segment => `
          <div class="desc"><strong>${this.escapeHtml(segment.name || '未命名路线')}：</strong>${this.escapeHtml(segment.description)}</div>
        `
      )
      .join('')
    return rows ? `<h3>路线描述</h3>${rows}` : ''
  }

  private renderMap(image: string): string {
    if (!image) return '<div class="empty-map">暂无轨迹截图</div>'
    return `<div class="map-frame"><img class="map-img" src="${image}" alt="路线对比截图" /></div>`
  }

  private renderMarkers(segments: Segment[]): string {
    const markers = segments.flatMap(segment =>
      segment.markers.map(marker => ({ marker, segment }))
    )
    if (!markers.length) return ''
    const rows = markers
      .map(
        ({ marker, segment }) => `
          <div class="marker-row">
            <div class="marker-title">
              <span class="tag">${this.escapeHtml(segment.name || '路线')}</span>
              <span class="tag">${this.getMarkerTypeText(marker.type)}</span>
            </div>
            <div class="desc">${this.escapeHtml(marker.content || '无描述')}</div>
          </div>
        `
      )
      .join('')
    return `<h3>参考物图钉（${markers.length}）</h3><div class="marker-grid">${rows}</div>`
  }

  private getFallbackImage(segments: Segment[], canvasElement: HTMLCanvasElement): string {
    const segmentImage = segments.find(segment => segment.image)?.image
    if (segmentImage) return segmentImage
    if (canvasElement) {
      try {
        return canvasElement.toDataURL('image/png')
      } catch {
        return ''
      }
    }
    return ''
  }

  private getMarkerTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      landmark: '参考物',
      note: '备注',
      photo: '照片',
      warning: '警告',
      checkpoint: '检查点',
      milestone: '里程碑'
    }
    return typeMap[type] || '标记'
  }

  private formatLength(pixelLength: number): string {
    const canvas = getA4CanvasSize(this.projectConfig.orientation)
    const formatted = formatDistance(
      pixelLength,
      !!this.projectConfig.scaleEnabled,
      this.projectConfig.scale,
      canvas
    )
    return `${formatted.value} ${formatted.unit}`
  }

  private formatDiff(compareLength: number, actualLength: number): string {
    const diff = compareLength - actualLength
    const percent = actualLength > 0 ? (diff / actualLength) * 100 : 0
    const sign = diff > 0 ? '+' : ''
    return `${sign}${this.formatLength(Math.abs(diff))} (${sign}${percent.toFixed(1)}%)`
  }

  private captureElement(element: HTMLElement): Promise<HTMLCanvasElement> {
    return html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: 900
    })
  }

  private waitForImages(root: HTMLElement): Promise<void> {
    const images = Array.from(root.querySelectorAll('img'))
    return Promise.all(
      images.map(
        img =>
          new Promise<void>(resolve => {
            if (img.complete) {
              resolve()
              return
            }
            img.onload = () => resolve()
            img.onerror = () => resolve()
          })
      )
    ).then(() => undefined)
  }

  private async addReportElements(pdf: jsPDF, report: HTMLElement) {
    const elements = Array.from(report.querySelectorAll<HTMLElement>('.pdf-cover, .group'))
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    const margin = 10
    const imgWidth = pageWidth - margin * 2
    const pageContentHeight = pageHeight - margin * 2
    let pageIndex = 0
    let cursorY = margin

    for (const element of elements) {
      const canvas = await this.captureElement(element)
      const ratio = imgWidth / canvas.width
      let imgHeight = canvas.height * ratio
      let renderWidth = imgWidth

      if (imgHeight > pageContentHeight) {
        const shrink = pageContentHeight / imgHeight
        imgHeight = pageContentHeight
        renderWidth = imgWidth * shrink
      }

      if (pageIndex > 0 && cursorY + imgHeight > pageHeight - margin) {
        pdf.addPage()
        pageIndex += 1
        cursorY = margin
      }

      const x = margin + (imgWidth - renderWidth) / 2
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, cursorY, renderWidth, imgHeight)
      cursorY += imgHeight + 5
      if (pageIndex === 0) pageIndex = 1
    }
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('zh-CN')
  }

  private getReportTitle(): string {
    return this.projectConfig.title || '定向轨迹记录'
  }

  private getFileName(): string {
    const safeTitle = this.getReportTitle().replace(/[\\/:*?"<>|]/g, '_')
    return `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}

export const defaultPDFConfig: PDFConfig = {
  orientation: 'portrait',
  pageSize: 'A4',
  includeMap: true,
  includeMarkers: true,
  includeDescriptions: true
}

export const defaultProjectConfig: ProjectConfig = {
  title: '定向轨迹记录',
  author: 'Orienteering App',
  date: new Date(),
  scale: 1000,
  scaleEnabled: false,
  orientation: 'portrait'
}
