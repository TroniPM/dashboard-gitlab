import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi'
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          primary: '#FC6D26',
          secondary: '#6E49CB',
          surface: '#1e1e2e',
          background: '#13131f',
          error: '#f44336',
          success: '#4caf50',
          warning: '#ff9800',
          info: '#2196f3'
        }
      },
      light: {
        dark: false,
        colors: {
          primary: '#FC6D26',
          secondary: '#6E49CB',
          surface: '#ffffff',
          background: '#f5f5f5'
        }
      }
    }
  }
})
