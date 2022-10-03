import {config} from 'dotenv'
import * as path from 'path'

config({
  path: path.join(process.cwd(), 'apps/velocity-fleet', '.env.local'),
})
