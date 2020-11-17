const transCbToPromise = (func, params = null) => {
  if (params) {
    return new Promise((resolve, reject) => {
      func(...params, function(result) {
        resolve(result)
      }, function(error) {
        reject(error)
      })
    })
  }
  return new Promise((resolve, reject) => {
    func(function(result) {
      resolve(result)
    }, function(error) {
      reject(error)
    })
  })
}

export default transCbToPromise
