import { vec3, mat4 } from 'gl-matrix'
import {
  FilterMap,
  UniformDescs,
  Setters,
  TypeMap,
  TextureOpts,
  TextureTypeMap,
  Camera,
  WrapMap,
  UBOOpts,
  UBOUniformInfo,
  UBODesc,
  TextureUnitMap,
} from './types'
import { constants } from './constants'

export default class GL_Handler {
  private _gl: WebGL2RenderingContext
  private _textureUnitMap: TextureUnitMap = []

  public canvas(
    width: number,
    height: number,
    opts: { [key: string]: string | boolean } = {},
    targetEl: HTMLElement | null = null,
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const target = targetEl || document.body
    target.prepend(canvas)
    this._gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      ...opts,
    })

    if (!this._gl) {
      console.warn("You're browser does not support WebGL 2.0. Soz.")
      return
    }
    return canvas
  }

  public backing(canvas: HTMLCanvasElement, colour: string, targetEl: HTMLElement | null = null) {
    const wrapper = document.createElement('div')
    wrapper.style.position = 'relative'

    const backing = document.createElement('canvas')
    backing.width = canvas.width
    backing.height = canvas.height
    backing.style.position = 'absolute'
    backing.style.top = '0'
    backing.style.left = '0'
    const backingCtx = backing.getContext('2d')
    backingCtx.fillStyle = colour
    backingCtx.fillRect(0, 0, backing.width, backing.height)

    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'

    wrapper.appendChild(backing)
    wrapper.appendChild(canvas)

    const target = targetEl || document.body
    target.prepend(wrapper)

    return backing
  }

  public shaderProgram(vsSource: string, fsSource: string, tfVaryings: string[] | null = null): WebGLProgram | null {
    const shaderProgram = this._gl.createProgram()
    const vertexShader = this.loadShader(this._gl.VERTEX_SHADER, vsSource)
    const fragmentShader = this.loadShader(this._gl.FRAGMENT_SHADER, fsSource)
    this._gl.attachShader(shaderProgram, vertexShader)
    this._gl.attachShader(shaderProgram, fragmentShader)

    if (tfVaryings) {
      this._gl.transformFeedbackVaryings(shaderProgram, tfVaryings, this.gl.INTERLEAVED_ATTRIBS)
    }

    this._gl.linkProgram(shaderProgram)

    if (!this._gl.getProgramParameter(shaderProgram, this._gl.LINK_STATUS)) {
      alert('Unable to initialize the shader program: ' + this._gl.getProgramInfoLog(shaderProgram))
      return null
    }

    return shaderProgram
  }

  private loadShader(type: number, source: string): WebGLShader {
    const shader = this._gl.createShader(type)
    this._gl.shaderSource(shader, source)
    this._gl.compileShader(shader)

    if (!this._gl.getShaderParameter(shader, this._gl.COMPILE_STATUS)) {
      alert('An error occurred compiling the shaders: ' + this._gl.getShaderInfoLog(shader))
      this._gl.deleteShader(shader)
      return null
    }
    return shader
  }

  public getUniformSetters(program: WebGLProgram): Setters {
    const numUniforms = this._gl.getProgramParameter(program, this._gl.ACTIVE_UNIFORMS)

    const setters: Setters = {}

    for (let ii = 0; ii < numUniforms; ++ii) {
      const uniformInfo = this._gl.getActiveUniform(program, ii)

      let name = uniformInfo.name
      // remove the array suffix.
      if (name.endsWith('[0]')) {
        name = name.substring(0, name.length - 3)
      }
      const location = this._gl.getUniformLocation(program, name)

      // the uniform will have no location if it's in a uniform block
      if (!location) continue

      const { constant, setterFn } = this.typeMap[uniformInfo.type]

      if (constant === 'SAMPLER_2D') this._textureUnitMap.push(name)

      const setter = setterFn(this._gl)
      setters[name] = {
        location,
        constant,
        setter,
      }
    }

    return setters
  }

  public getAttributeSetters(program: WebGLProgram): Setters {
    const numAttribs = this._gl.getProgramParameter(program, this._gl.ACTIVE_ATTRIBUTES)

    const setters: Setters = {}

    for (let ii = 0; ii < numAttribs; ++ii) {
      const attribInfo = this._gl.getActiveAttrib(program, ii)

      const name = attribInfo.name
      const location = this._gl.getAttribLocation(program, attribInfo.name)
      if (!location) continue

      const { constant, setterFn } = this.attrTypeMap[attribInfo.type]

      const setter = setterFn(this._gl)
      setters[name] = {
        location,
        constant,
        setter,
      }
    }

    return setters
  }

  public setUniforms(setters: Setters, uniforms: UniformDescs): void {
    for (const name in uniforms) {
      const values = uniforms[name]
      if (!setters[name]) continue // Uniform was not found in shader
      const { location, setter } = setters[name]
      setter(location, values, name)
    }
  }

  public createUBO({ program, name, uniforms, bindingPoint }: UBOOpts): UBODesc {
    const blockIndex = this._gl.getUniformBlockIndex(program, name)
    const blockSize = this._gl.getActiveUniformBlockParameter(program, blockIndex, this._gl.UNIFORM_BLOCK_DATA_SIZE)

    const uboBuffer = this._gl.createBuffer()
    this._gl.bindBuffer(this._gl.UNIFORM_BUFFER, uboBuffer)
    this._gl.bufferData(this._gl.UNIFORM_BUFFER, blockSize, this._gl.DYNAMIC_DRAW)
    this._gl.bindBuffer(this._gl.UNIFORM_BUFFER, null)
    this._gl.bindBufferBase(this._gl.UNIFORM_BUFFER, bindingPoint, uboBuffer)

    const uboVariableIndices = this._gl.getUniformIndices(program, uniforms)
    const uboVariableOffsets = this._gl.getActiveUniforms(program, uboVariableIndices, this._gl.UNIFORM_OFFSET)

    const uboVariableInfo: UBOUniformInfo = {}
    uniforms.forEach((name, index) => {
      uboVariableInfo[name] = {
        index: uboVariableIndices[index],
        offset: uboVariableOffsets[index],
      }
    })
    this._gl.uniformBlockBinding(program, blockIndex, bindingPoint)

    return { uniforms, info: uboVariableInfo, buffer: uboBuffer }
  }

  public setUBO(uboDesc: UBODesc, variableGetter: (i: number) => Float32Array) {
    this._gl.bindBuffer(this._gl.UNIFORM_BUFFER, uboDesc.buffer)
    uboDesc.uniforms.forEach((name, i) => {
      this._gl.bufferSubData(this._gl.UNIFORM_BUFFER, uboDesc.info[name].offset, variableGetter(i), 0)
    })
    this._gl.bindBuffer(this._gl.UNIFORM_BUFFER, null)
  }

  public createTexture(w: number, h: number, { type, data = null, filter = 'NEAREST', wrap = 'REPEAT' }: TextureOpts) {
    const texture = this._gl.createTexture()
    this._gl.bindTexture(this._gl.TEXTURE_2D, texture)
    /* Run texImage2D and load data */
    if (type) this.textureLoader[type](this._gl, w, h, data)
    /* Set MIN/MAG filter stuff */
    this.filterLoader[filter](this._gl)
    /* Texture wrapping */
    this.wrapLoader[wrap](this._gl)

    return texture
  }

  public createFramebuffer(tex: WebGLTexture): WebGLFramebuffer {
    this._gl.bindTexture(this._gl.TEXTURE_2D, null)
    const fb = this._gl.createFramebuffer()
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, fb)
    this._gl.framebufferTexture2D(this._gl.FRAMEBUFFER, this._gl.COLOR_ATTACHMENT0, this._gl.TEXTURE_2D, tex, 0)
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, null)
    return fb
  }

  public setFramebufferAttachmentSizes(
    width: number,
    height: number,
    targetTex: WebGLTexture,
    depthBuffer: WebGLRenderbuffer,
  ) {
    this._gl.bindTexture(this._gl.TEXTURE_2D, targetTex)
    const level = 0
    const border = 0
    const data = null
    this._gl.texImage2D(
      this._gl.TEXTURE_2D,
      level,
      this._gl.RGBA,
      width,
      height,
      border,
      this._gl.RGBA,
      this._gl.UNSIGNED_BYTE,
      data,
    )

    this._gl.bindRenderbuffer(this._gl.RENDERBUFFER, depthBuffer)
    this._gl.renderbufferStorage(this._gl.RENDERBUFFER, this._gl.DEPTH_COMPONENT16, width, height)
  }

  public initPicking() {
    // Create a texture to render to
    const targetTexture = this._gl.createTexture()
    this._gl.bindTexture(this._gl.TEXTURE_2D, targetTexture)
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR)
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE)
    this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE)

    // create a depth renderbuffer
    const depthBuffer = this._gl.createRenderbuffer()
    this._gl.bindRenderbuffer(this._gl.RENDERBUFFER, depthBuffer)

    // Create and bind the framebuffer
    const fb = this._gl.createFramebuffer()
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, fb)

    // attach the texture as the first color attachment
    const attachmentPoint = this._gl.COLOR_ATTACHMENT0
    const level = 0
    this._gl.framebufferTexture2D(this._gl.FRAMEBUFFER, attachmentPoint, this._gl.TEXTURE_2D, targetTexture, level)

    // make a depth buffer and the same size as the targetTexture
    this._gl.framebufferRenderbuffer(
      this._gl.FRAMEBUFFER,
      this._gl.DEPTH_ATTACHMENT,
      this._gl.RENDERBUFFER,
      depthBuffer,
    )

    return { fb, targetTexture, depthBuffer }
  }

  public createStreamBuffer(data: Float32Array): WebGLBuffer {
    const buffer = this._gl.createBuffer()
    this._gl.bindBuffer(this._gl.ARRAY_BUFFER, buffer)
    this._gl.bufferData(this._gl.ARRAY_BUFFER, data, this._gl.STREAM_DRAW)

    return buffer
  }

  public viewMat(opts?: Camera): mat4 {
    const defaultOpts: Camera = {
      pos: vec3.fromValues(0, 0, 1),
      up: vec3.fromValues(0, 1, 0),
      target: vec3.fromValues(0, 0, 0),
    }

    if (opts) {
      Object.assign(defaultOpts, opts)
    }

    return mat4.lookAt(mat4.create(), defaultOpts.pos, defaultOpts.target, defaultOpts.up)
  }

  public defaultProjMat(): mat4 {
    const fieldOfView = (45 * Math.PI) / 180
    const aspect = this.aspect
    const zNear = 0.1
    const zFar = 100.0

    return mat4.perspective(mat4.create(), fieldOfView, aspect, zNear, zFar)
  }

  public get gl(): WebGL2RenderingContext {
    return this._gl
  }

  public set gl(gl: WebGL2RenderingContext) {
    this._gl = gl
  }

  public get aspect(): number {
    return this._gl.canvas.clientWidth / this._gl.canvas.clientHeight
  }

  private samplerSetter(gl: WebGL2RenderingContext, loc: WebGLUniformLocation, texture: WebGLTexture, name: string) {
    const unit = this._textureUnitMap.indexOf(name)
    gl.uniform1i(loc, unit)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
  }

  public initReadPixels(width: number, height: number) {
    const format = this._gl.getParameter(this._gl.IMPLEMENTATION_COLOR_READ_FORMAT)
    const type = this._gl.getParameter(this._gl.IMPLEMENTATION_COLOR_READ_TYPE)
    const pixelSize = constants[format] === 'RGBA' ? 4 : 3
    const pixels = new Uint8Array(width * height * pixelSize)
    return (x: number, y: number) => {
      this._gl.readPixels(x, y, width, height, format, type, pixels)
      return pixels
    }
  }

  public enumToString(value: number) {
    for (const key in this._gl) {
      if (this._gl[key] === value) {
        return key
      }
    }
    return `0x${value.toString(16)}`
  }

  // prettier-ignore
  private typeMap: TypeMap = {
    0x84c0: { constant: 'TEXTURE0'                                   , setterFn: null},
    0x88e8: { constant: 'DYNAMIC_DRAW'                               , setterFn: null},
    0x8892: { constant: 'ARRAY_BUFFER'                               , setterFn: null},
    0x8893: { constant: 'ELEMENT_ARRAY_BUFFER'                       , setterFn: null},
    0x8a11: { constant: 'UNIFORM_BUFFER'                             , setterFn: null},
    0x8c8e: { constant: 'TRANSFORM_FEEDBACK_BUFFER'                  , setterFn: null},
    0x8e22: { constant: 'TRANSFORM_FEEDBACK'                         , setterFn: null},
    0x8b81: { constant: 'COMPILE_STATUS'                             , setterFn: null},
    0x8b82: { constant: 'LINK_STATUS'                                , setterFn: null},
    0x8b30: { constant: 'FRAGMENT_SHADER'                            , setterFn: null},
    0x8b31: { constant: 'VERTEX_SHADER'                              , setterFn: null},
    0x8c8d: { constant: 'SEPARATE_ATTRIBS'                           , setterFn: null},
    0x8b86: { constant: 'ACTIVE_UNIFORMS'                            , setterFn: null},
    0x8b89: { constant: 'ACTIVE_ATTRIBUTES'                          , setterFn: null},
    0x8c83: { constant: 'TRANSFORM_FEEDBACK_VARYINGS'                , setterFn: null},
    0x8a36: { constant: 'ACTIVE_UNIFORM_BLOCKS'                      , setterFn: null},
    0x8a44: { constant: 'UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER'  , setterFn: null},
    0x8a46: { constant: 'UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER', setterFn: null},
    0x8a40: { constant: 'UNIFORM_BLOCK_DATA_SIZE'                    , setterFn: null},
    0x8a43: { constant: 'UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES'       , setterFn: null},
    0x1406: { constant: 'FLOAT'                                      , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number  ) => gl.uniform1f(loc, val)},
    0x8B50: { constant: 'FLOAT_VEC2'                                 , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform2fv(loc, val)},
    0x8B51: { constant: 'FLOAT_VEC3'                                 , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform3fv(loc, val)},
    0x8B52: { constant: 'FLOAT_VEC4'                                 , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform4fv(loc, val)},
    0x1404: { constant: 'INT'                                        , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number  ) => gl.uniform1i(loc, val) },
    0x8B53: { constant: 'INT_VEC2'                                   , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform2iv(loc, val)},
    0x8B54: { constant: 'INT_VEC3'                                   , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform3iv(loc, val)},
    0x8B55: { constant: 'INT_VEC4'                                   , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform4iv(loc, val)},
    0x8B56: { constant: 'BOOL'                                       , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number  ) => gl.uniform1i(loc, val) },
    0x8B57: { constant: 'BOOL_VEC2'                                  , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform2iv(loc, val)},
    0x8B58: { constant: 'BOOL_VEC3'                                  , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform3iv(loc, val)},
    0x8B59: { constant: 'BOOL_VEC4'                                  , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniform4iv(loc, val)},
    0x8B5A: { constant: 'FLOAT_MAT2'                                 , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix2fv(loc, false, val)},
    0x8B5B: { constant: 'FLOAT_MAT3'                                 , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix3fv(loc, false, val)},
    0x8B5C: { constant: 'FLOAT_MAT4'                                 , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix4fv(loc, false, val)},
    0x8B5E: { constant: 'SAMPLER_2D'                                 , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, texture: WebGLTexture, name: string) => this.samplerSetter(gl, loc, texture, name)},
    0x8B60: { constant: 'SAMPLER_CUBE'                               , setterFn: null},
    0x8B5F: { constant: 'SAMPLER_3D'                                 , setterFn: null},
    0x8B62: { constant: 'SAMPLER_2D_SHADOW'                          , setterFn: null},
    0x8B65: { constant: 'FLOAT_MAT2x3'                               , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix2x3fv(loc, false, val)},
    0x8B66: { constant: 'FLOAT_MAT2x4'                               , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix2x4fv(loc, false, val)},
    0x8B67: { constant: 'FLOAT_MAT3x2'                               , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix3x2fv(loc, false, val)},
    0x8B68: { constant: 'FLOAT_MAT3x4'                               , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix3x4fv(loc, false, val)},
    0x8B69: { constant: 'FLOAT_MAT4x2'                               , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix4x2fv(loc, false, val)},
    0x8B6A: { constant: 'FLOAT_MAT4x3'                               , setterFn: (gl: WebGL2RenderingContext) => (loc: WebGLUniformLocation, val: number[]) => gl.uniformMatrix4x3fv(loc, false, val)},
    0x8DC1: { constant: 'SAMPLER_2D_ARRAY'                           , setterFn: null},
    0x8DC4: { constant: 'SAMPLER_2D_ARRAY_SHADOW'                    , setterFn: null},
    0x8DC5: { constant: 'SAMPLER_CUBE_SHADOW'                        , setterFn: null},
    0x1405: { constant: 'UNSIGNED_INT'                               , setterFn: null},
    0x8DC6: { constant: 'UNSIGNED_INT_VEC2'                          , setterFn: null},
    0x8DC7: { constant: 'UNSIGNED_INT_VEC3'                          , setterFn: null},
    0x8DC8: { constant: 'UNSIGNED_INT_VEC4'                          , setterFn: null},
    0x8DCA: { constant: 'INT_SAMPLER_2D'                             , setterFn: null},
    0x8DCB: { constant: 'INT_SAMPLER_3D'                             , setterFn: null},
    0x8DCC: { constant: 'INT_SAMPLER_CUBE'                           , setterFn: null},
    0x8DCF: { constant: 'INT_SAMPLER_2D_ARRAY'                       , setterFn: null},
    0x8DD2: { constant: 'UNSIGNED_INT_SAMPLER_2D'                    , setterFn: null},
    0x8DD3: { constant: 'UNSIGNED_INT_SAMPLER_3D'                    , setterFn: null},
    0x8DD4: { constant: 'UNSIGNED_INT_SAMPLER_CUBE'                  , setterFn: null},
    0x8DD7: { constant: 'UNSIGNED_INT_SAMPLER_2D_ARRAY'              , setterFn: null},
    0x0DE1: { constant: 'TEXTURE_2D'                                 , setterFn: null},
    0x8513: { constant: 'TEXTURE_CUBE_MAP'                           , setterFn: null},
    0x806F: { constant: 'TEXTURE_3D'                                 , setterFn: null},
    0x8C1A: { constant: 'TEXTURE_2D_ARRAY'                           , setterFn: null},
  }

  //  TODO: Attribute Setters
  // prettier-ignore
  private attrTypeMap: TypeMap = {
    0x1406: { constant: 'FLOAT'                                      , setterFn: null},
    0x8B50: { constant: 'FLOAT_VEC2'                                 , setterFn: null},
    0x8B51: { constant: 'FLOAT_VEC3'                                 , setterFn: null},
    0x8B52: { constant: 'FLOAT_VEC4'                                 , setterFn: null},
    0x1404: { constant: 'INT'                                        , setterFn: null},
    0x8B53: { constant: 'INT_VEC2'                                   , setterFn: null},
    0x8B54: { constant: 'INT_VEC3'                                   , setterFn: null},
    0x8B55: { constant: 'INT_VEC4'                                   , setterFn: null},
    0x8B56: { constant: 'BOOL'                                       , setterFn: null},
    0x8B57: { constant: 'BOOL_VEC2'                                  , setterFn: null},
    0x8B58: { constant: 'BOOL_VEC3'                                  , setterFn: null},
    0x8B59: { constant: 'BOOL_VEC4'                                  , setterFn: null},
    0x8B5A: { constant: 'FLOAT_MAT2'                                 , setterFn: null},
    0x8B5B: { constant: 'FLOAT_MAT3'                                 , setterFn: null},
    0x8B5C: { constant: 'FLOAT_MAT4'                                 , setterFn: null},
    0x8DC6: { constant: 'UNSIGNED_INT_VEC2'                          , setterFn: null},
    0x8DC7: { constant: 'UNSIGNED_INT_VEC3'                          , setterFn: null},
    0x8DC8: { constant: 'UNSIGNED_INT_VEC4'                          , setterFn: null},
  }

  // prettier-ignore
  private textureLoader: TextureTypeMap = {
    RGB      : (gl: WebGL2RenderingContext, w: number, h: number, data: Uint8Array | Float32Array): void => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB,  w, h, 0, gl.RGB,  gl.UNSIGNED_BYTE, data),
    RGBA     : (gl: WebGL2RenderingContext, w: number, h: number, data: Uint8Array | Float32Array): void => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data),
    RGBA16F  : (gl: WebGL2RenderingContext, w: number, h: number, data: Float32Array | null)      : void => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, data),
    R32F     : (gl: WebGL2RenderingContext, w: number, h: number, data: Float32Array | null)      : void => gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, data),
    RGBA32F  : (gl: WebGL2RenderingContext, w: number, h: number, data: Float32Array | null)      : void => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data),
    LUMINANCE: (gl: WebGL2RenderingContext, w: number, h: number, data: Float32Array | null)      : void => gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data)
  }

  private filterLoader: FilterMap = {
    NEAREST: (gl: WebGL2RenderingContext): void => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    },
    LINEAR: (gl: WebGL2RenderingContext): void => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    },
  }

  private wrapLoader: WrapMap = {
    CLAMP_TO_EDGE: (gl: WebGL2RenderingContext): void => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    },
    REPEAT: (gl: WebGL2RenderingContext): void => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    },
    MIRRORED_REPEAT: (gl: WebGL2RenderingContext): void => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT)
    },
  }
}
