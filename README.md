# GL-Handler

Another lightweight wrapper library for WebGL.

---

The general idea is that `GL-Handler` provides kind of a fuzzy interface between you and WebGL. Fuzzy in that it only really provides abstract classes or static methods for you to use. It really doesn't do everything for you.

After having created your own `pointSphere` class (inheriting from `Geometry`) and writing your shaders, the general workflow looks as follows:

```typescript
const G = new GL_Handler()
const canvas = G.canvas(512, 512)
const gl = G.gl
const pointsProgram = G.shaderProgram(vert, frag)

const camPos: [number, number, number] = [0, 0, 3]
let viewMat = G.viewMat({ pos: vec3.fromValues(...camPos) })
const projMat = G.defaultProjMat()
const modelMat = mat4.create()

const points = new PointSphere(gl, 10000)
points.linkProgram(pointsProgram)
points.rotate = { speed: 0.0005, axis: [1, 1, 1] }

const baseUniforms: UniformDescs = {
  u_ModelMatrix: modelMat,
  u_ViewMatrix: viewMat,
  u_ProjectionMatrix: projMat,
}

const uniformSetters = G.getUniformSetters(pointsProgram)
gl.useProgram(pointsProgram)
G.setUniforms(uniformSetters, baseUniforms)
gl.bindVertexArray(points.VAO)
gl.clearDepth(1.0)
gl.enable(gl.CULL_FACE)
gl.enable(gl.DEPTH_TEST)

function draw(time) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.clearColor(0.9, 0.9, 0.9, 1)

  G.setUniforms(uniformSetters, {
    ...baseUniforms,
    u_ModelMatrix: points.updateModelMatrix(time),
  })

  gl.drawArrays(gl.POINTS, 0, points.numVertices)

  requestAnimationFrame(draw)
}

requestAnimationFrame(draw)
```

The main benefit here is that `GL-Handler` takes care of setting up the matrices and can automatically find the relevant uniforms in the programs and creates the setter functions internally. So all you need to do it update the uniform value and tell `GL-Handler` which uniform to update.

---

See `./examples` for more... examples.
