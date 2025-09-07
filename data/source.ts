import type { IDataSource } from "./interfaces"
import { MockDataSource } from "./mock"
import { DataverseDataSource } from "./dataverse"

// Factory pattern for easy switching between data sources
export const dataSource: IDataSource =
  process.env.NEXT_PUBLIC_USE_MOCK === "true" ? new MockDataSource() : new DataverseDataSource()

// For development, default to mock data
export const getDataSource = (): IDataSource => {
  if (typeof window !== "undefined") {
    // Client-side: check localStorage or default to mock
    const useMock = localStorage.getItem("use-mock-data") !== "false"
    return useMock ? new MockDataSource() : new DataverseDataSource()
  }

  // Server-side: use environment variable or default to mock
  return process.env.NEXT_PUBLIC_USE_MOCK !== "false" ? new MockDataSource() : new DataverseDataSource()
}
