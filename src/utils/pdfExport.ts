import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Segment, ProjectConfig, PDFConfig } from '../types'

export class PDFExporter {
  private config: PDFConfig
  private projectConfig: ProjectConfig

  constructor(config: PDFConfig, projectConfig: ProjectConfig) {
    this.config = config
    this.projectConfig = projectConfig
  }

  async exportPDF(segments: Segment[], canvasElement: HTMLCanvasElement): Promise<void> {
    console.log('Starting PDF export...')
    console.log('Canvas element:', canvasElement)
    console.log('Segments:', segments)

    const pdf = new jsPDF({
      orientation: this.config.orientation,
      unit: 'mm',
      format: this.config.pageSize
    })

    // 获取页面尺寸
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    const margin = 20

    console.log('Page dimensions:', { pageWidth, pageHeight })

    let yOffset = margin

    // 添加标题
    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'bold')
    pdf.text(this.projectConfig.title || 'Orienteering Diary', pageWidth / 2, yOffset, {
      align: 'center'
    })
    yOffset += 15

    // 添加项目信息
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Author: ${this.projectConfig.author || 'Unknown'}`, margin, yOffset)
    pdf.text(
      `Date: ${this.projectConfig.date.toLocaleDateString('en-US')}`,
      pageWidth - margin - 30,
      yOffset
    )
    yOffset += 10

    // 添加比例尺信息
    pdf.text(`Scale: 1:${this.projectConfig.scale}`, margin, yOffset)
    yOffset += 15

    // 如果是多分段，添加目录
    if (segments.length > 1) {
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Contents:', margin, yOffset)
      yOffset += 10

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      segments.forEach((segment, index) => {
        if (yOffset > pageHeight - 50) {
          pdf.addPage()
          yOffset = margin
        }
        pdf.text(`${index + 1}. ${segment.name}`, margin + 5, yOffset)
        yOffset += 6
      })
      yOffset += 10
    }

    // 添加轨迹图（集中插入）
    if (this.config.includeMap && canvasElement) {
      try {
        const imgData = canvasElement.toDataURL('image/png')
        const imgWidth = pageWidth - 2 * margin
        const imgHeight = (canvasElement.height * imgWidth) / canvasElement.width
        if (yOffset + imgHeight > pageHeight - margin) {
          pdf.addPage()
          yOffset = margin
        }
        pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight)
        yOffset += imgHeight + 10
      } catch (error) {
        pdf.text('Map export failed', margin, yOffset)
        yOffset += 10
      }
    } else {
      // 如果没有地图，则跳过添加地图的逻辑
    }

    // 添加分段内容
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]

      // 检查是否需要新页面
      if (yOffset > pageHeight - 100) {
        pdf.addPage()
        yOffset = margin
      }

      // 分段标题
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${i + 1}. ${segment.name}`, margin, yOffset)
      yOffset += 8

      // 分段描述
      if (this.config.includeDescriptions && segment.description) {
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'normal')
        const maxTextWidth = pageWidth - 2 * margin
        const descriptionLines = this.splitTextToFit(segment.description, maxTextWidth, pdf)
        descriptionLines.forEach(line => {
          pdf.text(line, margin, yOffset)
          yOffset += 5
        })
        yOffset += 5
      }

      // 点位信息
      if (this.config.includePoints && segment.points.length > 0) {
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Track Points:', margin, yOffset)
        yOffset += 8

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')

        for (let j = 0; j < segment.points.length; j++) {
          const point = segment.points[j]

          // 检查是否需要新页面
          if (yOffset > pageHeight - 50) {
            pdf.addPage()
            yOffset = margin
          }

          const pointText = `Point ${j + 1}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) - ${
            point.type === 'curve' ? 'Curve' : 'Line'
          }`
          pdf.text(pointText, margin + 5, yOffset)
          yOffset += 5

          // 点位描述
          if (this.config.includeDescriptions && point.description) {
            const maxTextWidth = pageWidth - 2 * margin - 10
            const descLines = this.splitTextToFit(`  Note: ${point.description}`, maxTextWidth, pdf)
            descLines.forEach(line => {
              pdf.text(line, margin + 10, yOffset)
              yOffset += 4
            })
          }
        }
        yOffset += 5
      }

      // 标记信息
      if (this.config.includeMarkers && segment.markers.length > 0) {
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Special Markers:', margin, yOffset)
        yOffset += 8

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')

        for (const marker of segment.markers) {
          // 检查是否需要新页面
          if (yOffset > pageHeight - 50) {
            pdf.addPage()
            yOffset = margin
          }

          const markerText = `${this.getMarkerTypeText(marker.type)}: ${marker.content}`
          pdf.text(markerText, margin + 5, yOffset)
          yOffset += 5
        }
        yOffset += 5
      }

      yOffset += 10
    }

    // 保存PDF
    const fileName = `${this.projectConfig.title || 'Orienteering'}_${
      new Date().toISOString().split('T')[0]
    }.pdf`
    pdf.save(fileName)
  }

  private splitTextToFit(text: string, maxWidth: number, pdf: jsPDF): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = pdf.getTextWidth(testLine)

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  private getMarkerTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      checkpoint: 'Checkpoint',
      water: 'Water Station',
      medical: 'Medical Station',
      food: 'Food Station',
      danger: 'Danger Zone',
      custom: 'Custom Marker'
    }
    return typeMap[type] || 'Marker'
  }
}

export const defaultPDFConfig: PDFConfig = {
  orientation: 'portrait',
  pageSize: 'A4', // 修正为大写
  includeMap: true,
  includePoints: true,
  includeMarkers: true,
  includeDescriptions: true
}

export const defaultProjectConfig: ProjectConfig = {
  title: 'Orienteering Diary',
  author: 'Orienteering App',
  date: new Date(),
  scale: 1000,
  orientation: 'portrait' // 新增，补全必需字段
}
