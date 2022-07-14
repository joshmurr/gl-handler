import { vec3, mat4 } from 'gl-matrix'

export interface AttribDesc {
  location: number // Attrib loc
  num_components: number
  type: number // GLENUM
  size: number
  divisor?: number
}

export interface AllAttribDesc {
  i_Position?: AttribDesc
  i_Color?: AttribDesc
  i_Normal?: AttribDesc
  i_TexCoord?: AttribDesc
  i_Uid?: AttribDesc
}

export interface BufferDesc {
  buffer_object: WebGLBuffer
  stride: number
  attributes: AllAttribDesc
}

export interface UniformDesc<T> {
  type: string
  location: WebGLUniformLocation
  value: T
}

export interface RotationDesc {
  speed: number
  axis: [number, number, number]
}

export type UniformDescs = {
  [key: string]: number | number[] | mat4 | vec3 | WebGLTexture
}

export interface TypeInfo {
  constant: string
  setterFn?: any
}

export interface Setter extends TypeInfo {
  location: WebGLUniformLocation | number
  setter: any
}

export type Setters = {
  [key: string]: Setter
}

export type TypeMap = { [key: number]: TypeInfo }

export type TextureTypeMap = {
  [key: string]: (gl: WebGL2RenderingContext, w: number, h: number, data: Uint8Array | Float32Array) => void
}

export type FilterMap = {
  [key: string]: (gl: WebGL2RenderingContext) => void
}

export type WrapMap = {
  [key: string]: (gl: WebGL2RenderingContext) => void
}

export interface Camera {
  pos?: vec3
  up?: vec3
  target?: vec3
}

export interface TextureOpts {
  type: string
  data?: Uint8Array | Float32Array | null
  filter?: string
  wrap?: string
}
