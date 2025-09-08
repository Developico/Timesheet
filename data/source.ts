import type { IDataSource } from "./interfaces"
import { MockDataSource } from "./mock"
import { DataverseDataSource } from "./dataverse"

// New flag: if DATAVERSE_ENABLED === 'true' then use Dataverse, else mock fallback
function isDataverseEnabled() {
  if (typeof process !== "undefined" && process.env.DATAVERSE_ENABLED === "true") return true
  if (typeof window !== "undefined") {
    const override = localStorage.getItem("dataverse-enabled")
    if (override === "true") return true
    if (override === "false") return false
  }
  return false
}

export const dataSource: IDataSource = isDataverseEnabled()
  ? new DataverseDataSource()
  : new MockDataSource()

export const getDataSource = (): IDataSource => (isDataverseEnabled() ? new DataverseDataSource() : new MockDataSource())
