import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'

const COLOR_PRIMARY = '#ef4444'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: COLOR_PRIMARY,
          borderRadius: 6,
          fontSize: 13,
        },
        components: {
          Table: {
            cellPaddingBlock: 6,
            headerBg: '#1f2330',
            rowHoverBg: '#252937',
          },
          Modal: {
            contentBg: '#181b24',
            headerBg: '#181b24',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}
