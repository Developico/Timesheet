// Dataverse configuration and logical name mapping
// Allows overriding via env vars without code changes

export interface DataverseEntityConfig {
  entitySet: string
  id: string
  createdOn?: string
  modifiedOn?: string
  stateCode?: string
}

export const DV = {
  baseUrl: process.env.DATAVERSE_URL?.replace(/\/$/, ""),
  consultant: {
    entitySet: process.env.DATAVERSE_ENTITY_CONSULTANT || "tt_users", // or systemusers filtered
    id: process.env.DATAVERSE_FIELD_CONSULTANT_ID || "systemuserid",
    fullName: process.env.DATAVERSE_FIELD_CONSULTANT_FULLNAME || "fullname",
    email: process.env.DATAVERSE_FIELD_CONSULTANT_EMAIL || "internalemailaddress",
    avatar: process.env.DATAVERSE_FIELD_CONSULTANT_AVATAR || "tt_avatar", // optional custom
    stateCode: process.env.DATAVERSE_FIELD_CONSULTANT_STATE || "statecode",
  azureAdObjectId: process.env.DATAVERSE_FIELD_CONSULTANT_AAD_OID || "azureactivedirectoryobjectid",
  },
  project: {
    entitySet: process.env.DATAVERSE_ENTITY_PROJECT || "tt_projects",
    id: process.env.DATAVERSE_FIELD_PROJECT_ID || "tt_projectid",
    name: process.env.DATAVERSE_FIELD_PROJECT_NAME || "tt_name",
    code: process.env.DATAVERSE_FIELD_PROJECT_CODE || "tt_code",
    client: process.env.DATAVERSE_FIELD_PROJECT_CLIENT || "tt_client",
    billable: process.env.DATAVERSE_FIELD_PROJECT_BILLABLE || "tt_billable",
    meta: process.env.DATAVERSE_FIELD_PROJECT_META || "tt_metaprojectname", // or lookup text
    note: process.env.DATAVERSE_FIELD_PROJECT_NOTE || "tt_note",
    createdOn: process.env.DATAVERSE_FIELD_PROJECT_CREATEDON || "createdon",
    modifiedOn: process.env.DATAVERSE_FIELD_PROJECT_MODIFIEDON || "modifiedon",
    stateCode: process.env.DATAVERSE_FIELD_PROJECT_STATE || "statecode",
  },
  projectUser: {
    entitySet: process.env.DATAVERSE_ENTITY_PROJECTUSER || "tt_projectusers",
    id: process.env.DATAVERSE_FIELD_PROJECTUSER_ID || "tt_projectuserid",
    projectLookup: process.env.DATAVERSE_FIELD_PROJECTUSER_PROJECT || "_tt_projectid_value",
    userLookup: process.env.DATAVERSE_FIELD_PROJECTUSER_USER || "_tt_userid_value",
    createdOn: process.env.DATAVERSE_FIELD_PROJECTUSER_CREATEDON || "createdon",
  },
  timeRegister: {
    entitySet: process.env.DATAVERSE_ENTITY_TIMEREGISTER || "tt_timeregisters",
    id: process.env.DATAVERSE_FIELD_TR_ID || "tt_timeregisterid",
    startDateTime: process.env.DATAVERSE_FIELD_TR_START || "tt_startdatetime",
    durationMin: process.env.DATAVERSE_FIELD_TR_DURATION || "tt_durationmin",
    projectLookup: process.env.DATAVERSE_FIELD_TR_PROJECT || "_tt_projectid_value",
    userLookup: process.env.DATAVERSE_FIELD_TR_USER || "_tt_userid_value",
    billable: process.env.DATAVERSE_FIELD_TR_BILLABLE || "tt_billable",
    note: process.env.DATAVERSE_FIELD_TR_NOTE || "tt_note",
    createdOn: process.env.DATAVERSE_FIELD_TR_CREATEDON || "createdon",
    modifiedOn: process.env.DATAVERSE_FIELD_TR_MODIFIEDON || "modifiedon",
  },
  daysOff: {
    entitySet: process.env.DATAVERSE_ENTITY_DAYSOFF || "tt_daysoffs",
    id: process.env.DATAVERSE_FIELD_DAYSOFF_ID || "tt_daysoffid",
    date: process.env.DATAVERSE_FIELD_DAYSOFF_DATE || "tt_date",
    name: process.env.DATAVERSE_FIELD_DAYSOFF_NAME || "tt_holidayname",
  },
}

export function ensureDataverseBaseUrl() {
  if (!DV.baseUrl) throw new Error("DATAVERSE_URL env not set")
  return DV.baseUrl
}
